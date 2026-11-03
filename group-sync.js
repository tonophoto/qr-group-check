/* Shared QR trip check data. No camera/UI dependencies, for future antidisc adapter use. */
(function () {
  const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
  const APP = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
  const validTripId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);
  const validCode = value => typeof value === 'string' && /^(?:[A-N]|[1-9]|10)-[1-8]$/.test(value);

  async function connect(access, onUpdate, onFailure) {
    if (!access || !validTripId(access.tripId) || !access.uid || !['teacher', 'admin'].includes(access.role)) {
      throw new Error('qr-access-not-authorized');
    }
    const [{ getApp }, fs] = await Promise.all([import(APP), import(SDK)]);
    const db = fs.getFirestore(getApp());
    const tripId = access.tripId;
    const controlRef = fs.doc(db, 'qrTrips', tripId, 'groupControl', 'current');
    const roundRef = id => fs.doc(db, 'qrTrips', tripId, 'groupRounds', id);
    const checksRef = id => fs.collection(db, 'qrTrips', tripId, 'groupRounds', id, 'checks');
    const checkRef = (id, code) => fs.doc(db, 'qrTrips', tripId, 'groupRounds', id, 'checks', code);
    const verified = snapshot => !snapshot.metadata.fromCache && !snapshot.metadata.hasPendingWrites;
    let stopRound = () => {};
    let stopChecks = () => {};
    let stopControl = () => {};
    let currentId = '';
    let roundData = null;
    let checkData = [];
    let roundVerified = false;
    let checksVerified = false;
    let revision = 0;
    let disposed = false;
    const announce = () => {
      if (disposed) return;
      const confirmed = roundVerified && checksVerified;
      onUpdate({
        roundId: currentId,
        round: confirmed ? roundData : null,
        checks: confirmed ? checkData : [],
        confirmed
      });
    };
    stopControl = fs.onSnapshot(controlRef, { includeMetadataChanges: true }, snap => {
      if (disposed) return;
      if (!verified(snap)) {
        roundVerified = false;
        checksVerified = false;
        announce();
        return;
      }
      const id = snap.exists() && typeof snap.data().roundId === 'string' ? snap.data().roundId : '';
      if (id === currentId && roundVerified && checksVerified) return;
      revision += 1;
      const thisRevision = revision;
      stopRound();
      stopChecks();
      currentId = id;
      roundData = null;
      checkData = [];
      roundVerified = false;
      checksVerified = false;
      if (!id) {
        roundVerified = true;
        checksVerified = true;
        announce();
        return;
      }
      stopRound = fs.onSnapshot(roundRef(id), { includeMetadataChanges: true }, item => {
        if (thisRevision !== revision || disposed) return;
        roundVerified = verified(item) && item.exists();
        roundData = roundVerified ? item.data() : null;
        announce();
      }, onFailure);
      stopChecks = fs.onSnapshot(checksRef(id), { includeMetadataChanges: true }, items => {
        if (thisRevision !== revision || disposed) return;
        checksVerified = verified(items);
        checkData = checksVerified ? items.docs
          .filter(item => item.data().status === 'checked')
          .map(item => ({ code: item.id, checkedAt: item.data().checkedAt?.toDate?.().toISOString() || '' })) : [];
        announce();
      }, onFailure);
      announce();
    }, onFailure);

    async function requireCurrent(roundId) {
      if (!navigator.onLine) throw new Error('offline-no-check-confirmation');
      const snap = await fs.getDocFromServer(controlRef);
      if (!snap.exists() || snap.data().roundId !== roundId) throw new Error('round-not-current');
    }

    return {
      async start({ title, note, classMode, classGroups }) {
        if (!navigator.onLine) throw new Error('offline-no-check-confirmation');
        const safeGroups = classGroups.map(n => Number(n));
        if (!['alpha', 'numeric'].includes(classMode) || !safeGroups.length ||
          safeGroups.length > (classMode === 'alpha' ? 14 : 10) ||
          safeGroups.some(n => !Number.isInteger(n) || n < 1 || n > 8)) throw new Error('invalid-group-setup');
        if (String(title).length > 60 || String(note).length > 80) throw new Error('invalid-round-details');
        const groupCodes = [];
        safeGroups.forEach((count, index) => {
          const prefix = classMode === 'numeric' ? String(index + 1) : String.fromCharCode(65 + index);
          for (let number = 1; number <= count; number += 1) groupCodes.push(prefix + '-' + number);
        });
        const next = fs.doc(fs.collection(db, 'qrTrips', tripId, 'groupRounds'));
        await fs.runTransaction(db, async tx => {
          const pointer = await tx.get(controlRef);
          if (pointer.exists()) {
            const prior = pointer.data().roundId;
            if (typeof prior !== 'string' || !validTripId(prior)) throw new Error('invalid-previous-round');
            const prev = await tx.get(roundRef(prior));
            if (!prev.exists() || prev.data().status !== 'ended') throw new Error('previous-round-not-ended');
          }
          tx.set(next, {
            title: String(title), note: String(note), classMode, classGroups: safeGroups, groupCodes,
            status: 'active', createdBy: access.uid, createdAt: fs.serverTimestamp(), endedAt: null
          });
          tx.set(controlRef, { roundId: next.id, updatedBy: access.uid, updatedAt: fs.serverTimestamp() });
        });
        return next.id;
      },
      async setStatus(roundId, status) {
        if (!validTripId(roundId) || !['active', 'ended'].includes(status)) throw new Error('invalid-round');
        await requireCurrent(roundId);
        await fs.runTransaction(db, async tx => {
          const [pointer, target] = await Promise.all([tx.get(controlRef), tx.get(roundRef(roundId))]);
          if (pointer.data()?.roundId !== roundId || !target.exists()) throw new Error('round-not-current');
          if (target.data().status !== (status === 'ended' ? 'active' : 'ended')) throw new Error('invalid-round-transition');
          tx.update(roundRef(roundId), {
            status, endedAt: status === 'ended' ? fs.serverTimestamp() : null
          });
        });
      },
      async register(roundId, code) {
        if (!validTripId(roundId) || !validCode(code)) throw new Error('invalid-check-code');
        await requireCurrent(roundId);
        return await fs.runTransaction(db, async tx => {
          const [pointer, round, existing] = await Promise.all([
            tx.get(controlRef), tx.get(roundRef(roundId)), tx.get(checkRef(roundId, code))
          ]);
          if (pointer.data()?.roundId !== roundId || round.data()?.status !== 'active') throw new Error('round-not-active');
          const [prefix, serial] = code.split('-');
          const classNumber = round.data().classMode === 'alpha' ? prefix.charCodeAt(0) - 65 : Number(prefix) - 1;
          if (!Number.isInteger(classNumber) || classNumber < 0 ||
              classNumber >= round.data().classGroups.length ||
              Number(serial) > round.data().classGroups[classNumber]) throw new Error('group-not-configured');
          if (existing.exists()) return 'duplicate';
          tx.set(checkRef(roundId, code), {
            code, status: 'checked', checkedBy: access.uid, checkedAt: fs.serverTimestamp()
          });
          return 'new';
        });
      },
      dispose() {
        disposed = true;
        revision += 1;
        stopControl();
        stopRound();
        stopChecks();
      }
    };
  }
  window.QRGroupSync = Object.freeze({ connect });
})();
