# TASK-006-2 강화 관측 수신 계약

웹 정본. 운영 snapshot-v1과 별도로 ADDON-UPGRADE-001-6의 독립 v0.2.0 진단을 읽는다. 입력은 64 KiB UTF-8 이하의 JSON. 최상위 `kind=wgg-upgrade-diagnostics`, `schemaVersion=1`, `diagnosticVersion=0.2.0`, `context`, `observationCount`, `captureCount`, `observations`를 갖는다. 최대 64행/256회이며 총 캡처 횟수는 각 행의 합이다. 빈 진단의 context=null을 허용하며 저장되는 배치는 nonempty다. 추가 키를 허용하지 않는다. 실행 검증은 [parser](../../src/upgrade-diagnostic.mjs)가 정본과 함께 관리한다.

## 컨텍스트와 한 단계

| 구분 | 수신 의미 |
| --- | --- |
| 컨텍스트 | KR regionID=2, 지원 patch/seasonId, build·level·specializationIndex·specializationId·lootSpecializationId. loot ID 0 유지. 인덱스를 특성 ID로 사용하지 않는다. |
| 각 행 | `{captures, observation}`. 관측의 patch/build/regionID는 컨텍스트와 일치. observedAt은 Unix epoch 초, 미래 최대 5분. 원래 시각 보존. |
| 장비 | itemId, currentRank, maxRank, itemLevel, pvp, upgradeable. 관측되지 않은 값은 null. `identityState=unresolved`. GUID, 원본 링크, 계정 필드 금지. |
| costsObserved | nextRank=currentRank+1 및 maxRank 이하. increment와 정수 moneyCopper, currencies, items를 그대로 읽는다. 목록당 최대 20개, 유형별 ID 중복 거부. 실제 0 및 빈 배열 보존. |
| maxRank | currentRank=maxRank이며 nextRank, increment, moneyCopper, currencies, items 및 failurePresent는 null. |
| 할인과 한도 | row의 watermarkSlot, characterWatermark, accountWatermark는 원시 API 값. 각 비용의 discounted, watermark, partialTwoHand, accountWide, characterMeets는 개별 관측값이다. false·0·null을 구분한다. failurePresent는 원문 없이 상태만 보존한다. |
| 기본/다단계 | `baseCostState=unobserved`. 관측 할인으로 기본 가격을 역산하거나 다음 한 단계를 여러 단계에 외삽하지 않는다. |

명시적으로 고른 운영 스냅샷과 비교할 때 KR·패치·시즌·레벨·전문화와 원래 시각 차이 15분 이내를 확인한다. 운영 스냅샷에서 확인 가능한 장착 슬롯의 itemId·현재 rank·maxRank·PvE 레벨이 모두 맞으면 비교 후보로 제시할 수 있다. 여러 일치 슬롯은 모두 후보이며, 단독 일치도 동일 캐릭터나 동일 장비 인스턴스의 증명이 아니다. 원시 watermarkSlot을 장착 슬롯으로 대응시키지 않는다. 15분은 비교 조건이며 가격 유효기간을 뜻하지 않는다. 운영 스냅샷에 전리품 전문화나 영구 식별 증거가 없는 경우 진단으로 이를 채우지 않는다. 비용·관측·재화는 기존 추천 엔진에 전달하지 않는다.

애드온 측 실제 누적 12건 및 이전 할인 UI 2건을 검토했다. 원본을 웹에서 받거나 실행하지 않았다. 비할인 UI, 기본 비용 및 할인 적용 조건, 실제 인스턴스 대응과 Lua 5.1/인게임 교차 승인 이후 소비 추천과 운영 필드 합의를 별도로 진행한다. [실측 및 인계 원본](https://github.com/jeon950523/wow-gearpath-addon/blob/c38712f83c9dafefed7c64815661d4b1c611c505/docs/reports/ADDON-UPGRADE-001-6-live-session-review.md)
