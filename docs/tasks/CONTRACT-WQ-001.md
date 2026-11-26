# CONTRACT-WQ-001 — 전역퀘 수신 계약 확정 및 웹 MVP 연동

2026-11-26 KST. 사용자 승인 PRODUCT-ROADMAP의 PHASE 1/2 P0 실행 작업. 담당: 웹 Codex. 상태: 작업지시 등록, 구현/테스트 미실행. 기존 TASK/SIM 식별자를 재사용하거나 변경하지 않는다.

## 시작 및 범위
- 웹 기준 main 86e410ce7f2e06be3d8e7c2e9eedc7ab0779ae9f; 애드온 main d4ac483a629f186611b89f2b7d4c706ea8e26c4c, ADDON-003 PR #2 head 2066683ad86ecd3a5c76bb1084bf1b7191747798, ADDON-004H head 0201743562d417fa64264fb0133495fbfed2dc00. 시작 시 최신 양쪽 main/브랜치/PR을 재조회한다.
- AGENTS.md, docs/PRODUCT-ROADMAP.md, SSOT/HANDOFF/ROADMAP 및 외부 애드온 활용 정책을 읽는다. 웹만 수정하고 애드온은 읽기 전용. 이미 진행 중인 동일 작업이 있으면 중복 생성하지 말고 이어간다.
- 기준 애드온 [004H 인계](https://github.com/jeon950523/wow-gearpath-addon/blob/0201743562d417fa64264fb0133495fbfed2dc00/docs/reports/ADDON-004H-contract-handoff.md), [제안 Schema](https://github.com/jeon950523/wow-gearpath-addon/blob/0201743562d417fa64264fb0133495fbfed2dc00/contracts/proposals/ADDON-004H/world-quests.schema.json), [합성 snapshot](https://github.com/jeon950523/wow-gearpath-addon/blob/0201743562d417fa64264fb0133495fbfed2dc00/contracts/proposals/ADDON-004H/snapshot-world-quests.json), [초안 검사](https://github.com/jeon950523/wow-gearpath-addon/blob/0201743562d417fa64264fb0133495fbfed2dc00/contracts/proposals/ADDON-004H/test-draft.mjs)를 실제 읽고 원격 SHA 고정.
- 실측: 진단 0.1.3 보상 준비 16/16, 지도명 16/16, 장비 상세 2/2, 지도 29개, 지도 충돌 3/3 해소 기록. 만료 미확인 1행, 원시 골드 0 의미, 선택 보상, 실제 툴팁 대조/캐시 복구 일부 미검증. 초안 29/29는 제한적 V8 검사 증적이며 Node/표준 schema/웹 실행 PASS가 아님.
- 목표: 기존 v1에 선택 worldQuests 모듈 수신 계약을 확정하고 parseAddon → mergeSnapshots → validate → diagnose → UI를 실제 연결. ADDON-004I가 운영 수집기로 통합할 수 있게 정본 SHA와 조건을 인계. 실제 운영 v0.4.0 export는 아직 없으므로 합성 fixture와 실제 사용자 검증을 구분.

## 계약 및 안전성 검수
- 기존 계약, 장비, 재화, 3418 성운핵, 315 경계/솔플, null/0 및 기존 버전 회귀 유지. worldQuests 부재와 빈 목록 구별.
- 004H의 구조/필드/의미 검토, JSON Schema 2020-12 정본 통합, 기존 validator와 실제 표준 schema 검사 정합성 검증. 최상위/행/group의 허용 필드, 상태/값 일관성, ID/중복, UTC 시각 순서 및 미래 제한, 안전 정수/합계 overflow, 배열 크기/256 KiB UTF-8, 보호 데이터 제외. 미합의 변경은 인계에 기록하고 애드온 담당 확인 전 운영 출력 지원으로 주장하지 않는다.
- 모듈 독립 observedAt/discoveredAt, 캐릭터/패치/시즌/전문화/전리품 전문화 context, coverage/mapExpansion/discoveryPartial/maps, 위치 후보와 출처/불명확 상태, active/completed/expiry 정보, 보상별 시각과 상태 보존. specializationIndex를 특성 ID로 혼동하지 않는다.
- 골드는 observed 양수 copper만 확인된 표시 기본 보상. zeroUnverified와 null/미준비/실패를 구분. 확정 items, choices, currencies 및 faction 연계 화폐를 독립 처리. 선택 보상을 모두 더하지 않고 평판/화폐 보유량과 중복 집계하지 않는다. 실제 수령액/장착 적격성/DPS 추정 금지.
- 캐시 보상은 원 관측 시각을 보존하고 참고 표시만. 현재 활성 관측/전문화/발생 회차의 증거 없이 추천하지 않는다. 만료 불명/완료 불명/활성 불명/오래된 행은 확정 추천 제외. 위치 불명은 위치 기반 추천만 제외하고 정상 관측 보상 자체를 버리지 않는다.
- 병합은 동일 캐릭터 및 시즌에서 모듈 자체 시각 기준 최신 스캔 원자 교체, 과거 목록 덮어쓰기 방지, 동시각 충돌 경고/기존 유지, 멱등, 부분 스캔의 미발견을 완료로 판정하지 않음. 이전 버전 생략은 역사 보존 가능하나 최신 상태로 재라벨 금지. 웹에서 보상 캐시를 새로 조합하지 않는다.
- 제안 TTL 15분을 초기 보수적 정책 후보로 검토 후 명시; 실제 관측으로 입증된 TTL로 주장하지 않음. 장비 24시간 정책과 분리. 다른 캐릭터/전문화/회차 및 오래된 관측으로 합계/추천 금지.
- UI: 오늘 할 일의 활성 관측 목록, 보상 종류별 상태/부분합, 만료/범위/캐시/갱신 필요 표시, 선택 보상 별도. 관측된 표시 골드를 실제 보유량이나 성장 예산으로 합산 금지. 전체 지역 완전성, 실제 획득 보장, 위치 정확성 단정 금지.

## 직접 검증과 인계
- 기존 웹 60 unit/8 E2E 결과는 TASK-005A 역사적 기록이며 이번 실행을 별도 기록. npm ci, npm test, npm run build, npm run test:e2e(기존 Chromium headless), 표준 JSON Schema/실제 fixture 통합 및 민감정보/네트워크 미전송 검사. 독립 반례 추가: 과거/동시각/부분 목록, 캐시 시각 및 조건, 선택 비합산, 0/null/빈 배열, 큰 입력/중복/음수/overflow, 만료/완료/활성 미확인, 잘못된 위치, 전문화 변경, 보유량 불변, 기존 3418/315/솔플 회귀.
- 기능 브랜치 feature/contract-wq-001 (기존 동일 작업이 있다면 해당 브랜치 재사용). 한국어 목적별 커밋. 직접 검증·검수 통과 후 main 병합 및 Vercel Production 확인. Actions 신규 실행 금지(기존 수동 예외 정책), 유료 서비스 및 불필요한 C드라이브 복제 금지.
- docs/reports/CONTRACT-WQ-001-REPORT.md, docs/contracts/ADDON-004H-HANDOFF.md 및 SSOT/HANDOFF/ROADMAP/계약 CHANGELOG 갱신. 정본 계약 SHA, 애드온 참조 SHA, 승인/보류/변경 필드, 테스트 실제 명령/결과/환경, 미실행, 실제 운영 export 대기, ADDON-004I 진행 조건을 기록. 테스트하지 않은 것을 PASS로 표시 금지. 기능적/효율적 리뷰 구분.
- 합성 fixture 수신 검증이 완료되더라도 실제 0.4.0 운영 export/인게임 교차 검증 전 완전한 통합이라고 주장하지 않는다.

## 다음 순서
- ADDON-003 잔여 검증은 애드온 담당. 계약 정본 확정 후 ADDON-004I 운영 수집 통합 및 실제 교차 검증.
- P0 실제 강화 비용/할인 관측 계약과 성장 엔진 연동 준비. 미검증 비용·할인 및 실제 소비 추천 활성화 금지. 기존 Gear Upgrade Cost Tab 조사 후보는 권리/API/패치 확인 필요.
- 구렁·금고 수신 계약 및 MVP 추천. SIM-001/002는 핵심 MVP를 방해하지 않는 작은 준비 작업으로 진행 가능. PHASE 2 승인 전 데스크톱 앱/새 저장소 생성 및 SIM-003 로컬 실행 금지.
