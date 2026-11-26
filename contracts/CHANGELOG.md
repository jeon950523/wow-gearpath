# 스냅샷 계약 변경 이력

- v1 · TASK-004. ADDON-003A 0.3.0의 9종 재화와 patch를 유지합니다. `undercoin`, `nebulousVoidcore`, `voidlightMarl` 수신과 선택 ID·범위·상한을 추가했습니다. 소비 검증과 미궁 파편 수신은 별도입니다. [003B 인계](../docs/contracts/ADDON-003B-HANDOFF.md)

- v1 · CONTRACT-001. ADDON-002의 직업·전문화·역할과 강화 상세 선택 필드를 지원합니다. 기존 영문 트랙 키 의미를 유지합니다. 선택적인 `fieldSources.progress` 항목별 관측 시각은 전체 진행 관측 시각보다 우선합니다. 기존 v1 내보내기는 전체 진행 시각을 사용합니다.

- v1 · TASK-003. 웹 저장소를 정본으로 지정했습니다. 애드온 0.1.1의 기존 필드를 유지합니다. 선택 필드 `patch`, `resources.*.state`, `extensions`를 문서화했습니다.
- v1 · ADDON-001. 장착 슬롯, 캐릭터 골드, 명시적 null, 수집 시각과 경고를 내보냅니다. 0.1.1에서 활·총·석궁의 보조 슬롯 가중치 결함을 수정했습니다.

[JSON Schema](snapshot-v1.schema.json) · [기본 예제](examples/mock-snapshot.json) · [사냥꾼 회귀](examples/hunter-regression.json)

소비자는 자신이 이해하는 필드만 읽습니다. 기존 v1의 패치 누락은 경고와 함께 허용합니다. 스키마 검사에 더해 웹은 슬롯 중복, 캐릭터 일치, 시즌, 시각, 입력 크기를 검사합니다. 리소스 상태 `observed`는 정수(0 포함), `uncollected`, `failed`, `incomplete`, `locked`는 각각 미수집, 실패, 미완료, 미해금이며 value는 null입니다. 진행 필드의 false와 0은 관측값입니다.

향후 선택 필드는 namespaced extensions 또는 기존 객체에 하위 호환으로 추가합니다. 강화 단계, 전문화, 능력치, 가방/은행, 퀘스트, 금고 후보, 상인, 추가 전리품 이력은 필드별 시각·상태와 인스턴스 식별 기준을 함께 정의해야 합니다. 기존 필드 삭제·의미 변경은 새 스키마 버전과 호환성 테스트가 필요합니다. 애드온 담당자는 계약 변경 후 두 예제와 웹 `npm test`에서 호환 여부를 확인하세요.

- v1 · TASK-005A. KR 12.1.5에서 관측한 성운의 공허핵 ID를 3418로 정정했습니다. 과거 3513과 ID 없는 애드온 수량은 가져오기 호환 처리에서 격리합니다. 키와 스키마 버전은 유지합니다. [인계](../docs/contracts/ADDON-003B-HANDOFF.md)

- v1 · CONTRACT-WQ-001. 선택적 worldQuests 스캔, 독립 관측/캐시 상태 및 표시 보상 계약을 추가했다. [정책 및 ADDON-004I 인계](../docs/contracts/ADDON-004H-HANDOFF.md)

- TASK-006. 웹 표시·활동 모델을 추가했다. snapshot-v1 wire schema 변경은 없으며 강화 관측은 [제안](../docs/contracts/UPGRADE-OBSERVATIONS-PROPOSAL.md)으로 유지한다.

- TASK-006-1. v1 형식과 해석은 유지한다. 소지금 정수 골드와 전역퀘 표시 보상 정수 코퍼를 웹 화면에서 올바르게 구분했다.

- TASK-006-2/006-3. 운영 snapshot-v1 형식은 유지한다. 독립 강화 진단과 SavedVariables 외부 컨테이너 계약은 docs/contracts에서 관리한다.
