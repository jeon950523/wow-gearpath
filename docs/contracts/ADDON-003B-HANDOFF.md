# ADDON-003B 웹 계약 전달

웹 최초 구현 SHA: c7925be30bc6e7e3bc569bfa29464d7b2fb526d9. 3418 계약 수정 SHA: 0d45169288d4bc5727bd35e9ea667ba3b27fc6b7. 애드온 교차 검증 SHA: 2066683ad86ecd3a5c76bb1084bf1b7191747798. 공통 계약은 [snapshot-v1.schema.json](../../contracts/snapshot-v1.schema.json)이며 `schemaVersion: 1`을 유지합니다. 아래 세 개는 **웹 수신 키와 의미를 확정**했습니다. ID와 한국어 명칭은 조사 근거를 적었으며, 애드온 운영 활성화 전 한국 12.1.5 클라이언트에서 실제 ID·명칭·수량·범위를 대조하세요.

| 수신 키 | ID/유형 | 현재 상태 |
| --- | --- | --- |
| `undercoin` | 2803 · 화폐 | 지하의 주화. [라이브 한국어 항목](https://www.wowhead.com/ko/currency=2803). 구렁 상인 가격 보류. |
| `nebulousVoidcore` | 3418 · 화폐 | [한국 12.1.5 실측](https://github.com/jeon950523/wow-gearpath-addon/blob/2066683ad86ecd3a5c76bb1084bf1b7191747798/docs/reports/VOIDCORE-CONTRACT-CORRECTION.md)에서 발견 상태와 UI 잔액이 일치. 3513은 당시 미발견 상태였으며 다른 용도는 미확인. |
| `voidlightMarl` | 3316 · 화폐 | 공허불빛 이회토. [라이브 한국어 항목](https://www.wowhead.com/ko/currency=3316). 사용자 표현 ‘정화토’와의 동일성 미확인. |
| 미궁 영웅/신화 파편 | 285801 / 285065 | [PTR 아이템 근거](https://www.wowhead.com/ptr-2/item=285065/mythical-soul-fragment)와 라이브 화폐 전환 보고가 충돌합니다. 현재 KR의 유형·ID·명칭·교환 조건을 실측하기 전에는 키를 부여하지 않습니다. |

### 형식

- `source`: 애드온 행은 `addon`. `observedAt`: 타임존 포함 ISO 8601. `value`: `observed`에서만 0 이상 안전 정수(최대 2^53−1). `uncollected`, `failed`, `incomplete`, `locked`에서는 null. 이전 v1에서 state가 없으면 value로 관측/미수집만 구분합니다.
- `kind`: 선택. `currency`, `item`, `money`. `currencyId` 또는 `itemId`: 선택 양의 안전 정수, 해당 키·유형과 일치해야 합니다. 성운의 공허핵의 애드온 관측 수량에는 3418이 필수입니다. 다른 두 화폐는 ID가 제공될 때 등록된 ID와 일치해야 합니다.
- `scope`: 선택. `character`는 개별 잔액, `warband`는 실제 공유 잔액, `unknown`은 미확인입니다. 전송 가능하다는 사실만으로 공유 잔액으로 표시하지 않습니다. 골드는 캐릭터 소지 골드입니다. 같은 공유 재화 행끼리 합산하지 않습니다.
- `name`: 선택, 클라이언트 표시 문자열 1–80자. `maxQuantity`, `weeklyEarned`, `weeklyLimit`: 선택, 0 이상 안전 정수. API가 명확히 제공할 때만 포함합니다. 선택 메타데이터는 null이나 생략으로 남길 수 있습니다. 상인 가격·보상·소비 조건과 획득 제한의 해석은 시즌 룰이 소유합니다.

다음은 `resources` 아래 들어가는 가상 예시입니다.

```json
{
  "undercoin": {
    "source": "addon", "observedAt": "2026-11-26T12:34:56Z",
    "kind": "currency", "currencyId": 2803, "scope": "unknown",
    "name": "지하의 주화", "state": "observed", "value": 0
  },
  "nebulousVoidcore": {
    "source": "addon", "observedAt": "2026-11-26T12:34:56Z",
    "kind": "currency", "currencyId": 3418, "state": "uncollected", "value": null
  }
}
```

웹은 위 세 키의 수동 입력과 가져오기를 지원합니다. 미궁 파편, 외부 계정 ID, 임의 키, 신규 재화 소비 계산은 이 계약 범위 밖입니다. 신규 키를 기존 제작 키로 대신 보내지 마세요.

애드온 검증은 게임의 화폐 창/가방과 ID별 현지화 명칭·수량·범위 대조, 은행 포함 여부 확인, 0·미발견·수집 실패 각 예제 생성, 개인 정보 제거 순서로 진행합니다. 그 뒤 익명 예제를 웹 정본의 `npm test`와 헤드리스 가져오기 검사에 전달합니다. 수동 CI 정책을 유지합니다.

v0.3.1 이하 및 버전 없는 3513은 브라우저 가져오기에서만 미확인으로 격리합니다. ID 없는 애드온 관측 수량도 재수집을 안내합니다. 3513을 합산하거나 3418로 재라벨하지 않습니다. 정규 계약에는 3513을 허용하지 않으며 3418 관측 0과 미수집 null을 구분합니다. 수동 수량은 사용자가 화면에서 확인할 수 있으며 공허핵 소비 계산에는 반영하지 않습니다.

웹 교차 검증 결과와 남은 애드온 검증은 [TASK-005A 보고서](../reports/TASK-005A-REPORT.md)를 참고하세요.
