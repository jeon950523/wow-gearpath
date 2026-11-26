# GROWTH-DIAGNOSTICS-STORAGE-001 웹 정본

TASK-006-4 · 2026-11-27 KST. [애드온 저장 제안](https://github.com/jeon950523/wow-gearpath-addon/blob/90b574c0162b1d4da8f9afafcc725fb87e2e08a9/docs/contracts/GROWTH-DIAGNOSTICS-STORAGE-001-PROPOSAL.md)을 바탕으로 별도 상인·제작 관측 계약을 정의한다.

## 저장 경계와 버전

- 통합 진단 애드온 하나가 신규 전역 `WowGearPathGrowthDiagnosticsDB`를 소유한다. 운영 `WowGearPathDB`, 강화 `WowGearPathUpgradeDB`, 각각의 버전과 기존 `lastExport`는 종전 계약을 따른다. 자동 이관·공유 쓰기·운영 스냅샷 합성은 하지 않는다.
- Lua 파일은 신규 전역의 단일 데이터 할당이다. 테이블을 디코딩하면 [저장 v1 스키마](../../contracts/growth-diagnostics-storage-v1.schema.json)에 해당한다. `characters`와 두 종류의 기록은 1부터 연속한 배열이다. 빈 DB 또는 한 종류만 있는 캐릭터는 허용하고 두 종류가 모두 빈 행은 생략한다. `storageVersion=1`은 내부 JSON의 버전과 독립이다.
- 캐릭터 행은 `region=kr, realmDisplayName, name, merchant, craft`만 가진다. ASCII 영숫자·공백·하이픈과 한글 완성형, 앞뒤 공백 금지, 각각 UTF-8 128바이트로 제한한다. 표시 서버명과 이름 조합의 ASCII 대소문자를 무시해 파일 내 중복을 검출한다. 이 값은 로컬 후보 키다. 개명·서버 이전·동명이인·파일 간 신원이나 인스턴스를 자동 결합하지 않는다.
- 최대 16명, 캐릭터·종류별 8개 기록, UTF-8 원문 전체 2 MiB. 상인 개별 64 KiB, 제작 개별 256 KiB. 내부 값은 원문 JSON 문자열이다. 종류별 배열의 epoch 초가 감소하거나 미래이면 거부한다. 같은 초의 다른 원문은 순서대로 남기고 같은 원문만 동일 종류에서 중복 거부한다. 보존된 기록은 원래 관측 시각·패치 그대로 과거 자료로 표시한다. 추가 실패 시 기존 DB를 보존하며 자동 삭제·퇴거는 없다.
- 애드온 쓰기는 열린 UI에서 명시적으로 요청한 체크포인트만 지원한다. 비전투 KR, 수집 시작·종료 맥락 일치, 최대 5초, 유효한 공개 JSON 확인 후 원자 교체한다. 내부 비교 GUID·링크는 원문에 포함하지 않는다. WoW의 파일 기록은 종료·로그아웃·재장전 이후 확인한다. 삭제는 사용자가 확인한 현재 캐릭터·종류만 대상으로 한다.
- 신규 저장 루트의 운영 웹 가져오기는 이 작업 범위에 포함하지 않는다. 이후 구현은 파일 선택 방식, 비실행 파싱, 개인정보 및 네트워크 미전송, 크기 제한과 별도 다운로드만 사용한다. [참조 검증기](../../src/growth-diagnostics-contract.mjs)는 디코딩 이후의 JSON 계약 검증용이며 앱에 연결되지 않았다.

## 종류별 JSON

공통 필드는 kind/schemaVersion/diagnosticVersion/patch/build/regionID/observedAt이다. 현재 serializer 대상으로 KR regionID=2, patch=12.1.5, UTC Unix epoch 초, source build 양의 정수를 사용한다. 관측 제한을 현재 시즌 가격의 유효기간으로 해석하지 않는다. 데이터 필드는 스키마의 allowlist만 허용하고 미관측 원시 스칼라는 null, 실제 0과 false는 그대로 표시한다.

| 종류 | 내부 스키마 | 수신 의미 |
| --- | --- | --- |
| 상인 | [merchant v1](../../contracts/merchant-diagnostics-v1.schema.json) | `wgg-merchant-diagnostics`, 진단 0.1.0. visibleMerchantListOnly, NPC/지도/전문화/필터와 보이는 행만 보존한다. 동일 itemID라도 다른 상품 인덱스는 독립이다. 가격 priceCopper와 typed 교환 비용을 분리한다. 교환 정보 unobserved/partial/noExtendedCost/observed를 구분한다. 누락과 원시 0은 무료가 아니며 isPurchasable/isUsable은 그때의 플래그다. 실제 비용·적격성은 unverified다. |
| 제작 | [craft v1](../../contracts/craft-diagnostics-v1.schema.json) | `wgg-craft-diagnostics`, 진단 0.5.0. recipeSchematic/personalCraft/customerDraft를 분리한다. schematic의 quantityRequired는 슬롯 속성, allocations는 그 시점 선택 배정량이다. 각 후보의 itemID/currencyID는 분리하고 후보를 모두 합하지 않는다. |

제작 serializer는 진단 원시 출력을 직접 통째로 옮기지 않는다. draft, target, preview, inventory, catalog로 필드를 묶고 typed ID는 itemID 또는 currencyID 하나만 보낸다. postingFeeCopper와 tipCopper는 서로 독립된 미제출 주문의 관측값이다. 고객 최소 품질과 개인 제작 미리보기 품질 출처가 달라 서로 대신 사용할 수 없다. 재제작 대상 식별은 같은 관측의 원시 후보로만 유지한다. 격리된 재료 잔액은 은행 제외 아이템·캐릭터 화폐·계정 화폐·범위 미확인 화폐로 나눈다. 두 no-bank 차이는 비교용이며 실제 필요량, 부족량, 소모 또는 합산 비용으로 해석하지 않는다. catalog 링크는 공개 분류 증거 키와 행 번호만 사용한다. 효과 힌트는 미검증 상태로 한정하며 비공개 원문, 주문 번호, 사용자 메모, 타인 정보, 링크를 출력하지 않는다.

실제 상인 가격·교환 조건·제작 결과·효과·소모량·재료 보존·장착 및 제작 가능 여부는 별도로 검증한다. 이 계약으로 실제 소비 추천을 활성화하지 않는다.

## 합성 자료와 애드온 인수

[상인](../../contracts/examples/merchant-diagnostics-v1-synthetic.json), [제작](../../contracts/examples/craft-diagnostics-v1-synthetic.json), [캐릭터별 저장 JSON](../../contracts/examples/growth-diagnostics-storage-v1-synthetic.json), [Lua 저장 모양](../../contracts/examples/growth-diagnostics-storage-v1-synthetic.lua)은 모두 합성이다. 표준 JSON Schema와 별도 의미 검증을 모두 사용한다. 다음 단계는 애드온 담당의 serializer와 저장 체크포인트 연결, 각 모듈 Lua 5.1/5.4 회귀, 실제 두 캐릭터·재장전·수량 및 UI 대조다. 본 TASK 번호와 순서를 유지한다.
