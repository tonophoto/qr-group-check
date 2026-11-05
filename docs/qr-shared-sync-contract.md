# QR班チェック・端末間同期と将来antidisc連携のデータ契約

Status: **Draft / NOT RELEASE APPROVED** (2026-11-05)

## 今回の最小実装

- 班チェックは既存 `index.html` と読み取り音・表示演出を流用。
- `auth-gate.js` は QR 専用 Google Auth + `qrTrips/{qrTripId}/members/{googleUid}` を利用。写真画面は読込まない。
- `members.html`/`members.js` で QR 班チェックの参加申請・承認だけ行う。初期管理者の登録は別の承認済み運用が必要。
- `group-sync.js` はスキャンUIと無関係な Firestore データ境界。複数端末は同一 trip/round の記録を購読する。
- `npm run build:qr` は allowlist だけを `dist-qr` にコピー。Firebase Hosting の `public` は `dist-qr` のみ。**リポジトリ直下や旧Hosting Versionを公開・復元しない。**

## Firestore データ契約（暫定 v1）

```text
qrTrips/{qrTripId}/members/{googleUid}
qrTrips/{qrTripId}/joinRequests/{googleUid}

qrTrips/{qrTripId}/groupControl/current
  roundId: string
  updatedBy: googleUid
  updatedAt: serverTimestamp

qrTrips/{qrTripId}/groupRounds/{roundId}
  title: string (<= 60)
  note: string (<= 80)
  classMode: "alpha" | "numeric"
  classGroups: number[]  (1-14 or 1-10, each 1-8)
  groupCodes: string[] (allowed group codes generated from classMode/classGroups)
  status: "active" | "ended"
  createdBy: googleUid
  createdAt: serverTimestamp
  endedAt: null | serverTimestamp

qrTrips/{qrTripId}/groupRounds/{roundId}/checks/{groupCode}
  code: "A-1"..."N-8" or "1-1"..."10-8"
  status: "checked"
  checkedBy: googleUid
  checkedAt: serverTimestamp
```

`roundId` はクライアント生成の Firestore 自動IDで、チェック回ごとに別 document を持つ。班コードはそのまま doc ID に使う。同一チェック回・同一班にチェックは **一件のみ**。トランザクションとサーバー側認可の組合せが必須。

今回のクライアントは groupControl で参照する現在チェック回を購読し、当該 round の checks だけを表示する。**サーバー確認が取れない状態（キャッシュ・未確定書込・オフライン）ではチェックの成功を表示しない。** 過去の `localStorage` 記録は共有記録として復元しない。

## 将来の antidisc との接続境界

`antidisc/src/qrGroupCheck.ts` は現在 `schools/{schoolId}/trips/{tripId}/checkRounds/.../groupChecks/{groupId}` を使う。こちらは **別の既存業務ドメイン** であり、今回の `qrTrips` のレコードを同一視しない。

次期統合時は以下が必須：

1. `qrTripId` と `schoolId/tripId` の承認済み対応表。ID文字列の偶然の一致では紐付けない。
2. `groupCode` と antidisc の `groupId` (`a01`など) の明示的なタグ結合。
3. QR Google UID と antidisc 独自認証の安全な権限ブリッジ。**Firebase Rulesを全ログインユーザーへ開放しない。**
4. 正本は一つだけに定め、承認前に二重書込み・サイレント移行・自動バックフィルを行わない。
5. 将来の antidisc UI は共通同期アダプター越しに表示・登録し、既存ロールやRulesを破壊しない。

**今回 antidisc のソースには手を加えない。** 本仕様は将来互換を保証するものではなく、互換設計の境界を固定するための暫定契約。

## 本番に適用する前の絶対条件

1. 停止中の `school-trip-chat` の**現在適用中の** deny-all Ruleset を正本として読み取り確認。リポジトリの古い `firestore.rules` を無条件で deploy しない。
2. QR namespace のみを開く最小限のRulesを別途レビュー。現在の `antidisc/firestore.rules` の `groupRounds` に残る一般的 `allow read, write` は **そのままでは不十分**。明示的に制限する。Firestore Rules は OR 評価のため、別 match を追加するだけで旧許可を打ち消せない。
3. `groupControl/current` は QR teacher/admin のみ read/write。書込フィールド・型・更新者・時刻を検証し、現在roundがactiveの間に別roundを勝手に指せないこと、round参照先が合法なことを検証。
4. `groupRounds/{roundId}` は必要な項目だけを作成可能、active→ended/ended→activeのみの状態遷移、その他改変を拒否。異旅行を拒否。
5. `checks/{groupCode}` は active/current round に対する teacher/admin の **createのみ**、doc IDとcode一致、codeがround.groupCodesに含まれること、serverTimestamp、checkedBy==auth.uid、status checked を検証。更新・削除は不可。**クライアント側のみの班設定検証をRulesの代替としない。**
6. `joinRequests` と `members` は既存の制約（申請者本人作成、QR管理者による承認、無効ユーザー拒否）を維持。
7. Emulatorで「別旅行、未登録・disabled、写真ロール、本人でないcheckedBy、偽のチェック回、重複・同時押し、終了後、offline、端末A/B反映」を検証。GitHub Actions自動実行なし。
8. QR Hosting siteID `school-trip-chat-qr`、Auth許可ドメイン、配信対象差分と切戻し先を**実環境の読取**で確認。旧Versionには .git ファイル一覧があったため **旧Versionの単純復元を禁止**。
9. Cloud Run/Functions/Scheduler/Storage/VoIP/通常Hostingは停止維持。QR Hosting と QR namespace だけの個別 Go 承認がない限り No-Go。

## 制限・残課題

- Auth/Firestore Emulator、独立A/Bクライアント、許可済みローカルChromiumで検証済み。実機2台・実Googleログイン・実カメラ読取は未検証。[検証記録](pr-11-local-verification-2026-11-05.md)参照。
- QR専用Rules候補は `verification/firestore.qr-only.rules`。本番への適用は行っていない。
- `admin`による参加者承認は QR 専用画面を提供するだけで、管理者アカウントの初期セットアップは行わない。
- チェック回の終了や次の開始は共有操作。意図せぬ同時操作をUIで完全に防ぐには実機検証が必要。
- オフラインでは記録不可。データの同期が確定するまで「チェック済み」と見なさない。
- 旧Hosting Versionの .git 混入の外部取得可否、情報漏洩有無、監査ログは未確認で別の調査課題。
