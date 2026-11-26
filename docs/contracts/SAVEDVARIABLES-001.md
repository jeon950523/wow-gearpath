# SAVEDVARIABLES-001 저장 및 웹 수신 계약

웹 정본. [애드온 제안 df3be9d](https://github.com/jeon950523/wow-gearpath-addon/blob/df3be9d5474ae3adc5bf16494aa8cf100c997000/docs/contracts/SAVEDVARIABLES-001-PROPOSAL.md)의 소유권과 JSON 문자열 기반 구조를 승인한다. ADDON-004I-5와 ADDON-UPGRADE-001-7은 아래 수신 제약을 기준으로 구현한다. 실제 WoW 생성 파일의 호환 승인과 웹 합성 검증은 별도다.

## 소유권과 컨테이너

- 운영 애드온은 `WowGearPathDB`만 저장한다. v0은 버전 없는 `{lastExport=<snapshot-v1 JSON 문자열>}`. 실제 운영 Core/TOC에서 확인했다. v1은 `{storageVersion=1,characters={...},lastExport?<JSON 문자열>}`. v1의 lastExport는 기존 도구를 위한 선택 호환 사본이다. 저장 성공 시 호환 사본을 업데이트한다.
- 독립 강화 진단은 `WowGearPathUpgradeDB={storageVersion=1,characters={...}}`만 저장한다. 행의 `upgradeJson`은 [독립 진단 v1](UPGRADE-DIAGNOSTICS-V1.md)의 nonempty JSON 문자열이다. 명시적 성공 체크포인트만 저장하며, 메모리 세션 clear와 영속 데이터 삭제는 별도다.
- 두 v1의 characters는 1부터 연속한 배열(최대 16명)이며 빈 배열을 허용한다. 모든 행은 `region="kr"`, `realmDisplayName`, `name`을 갖는다. 운영 행은 `realm` slug 및 `snapshotJson`이 필수이며 `worldQuestSnapshotJson`은 선택이다. 강화 행은 slug가 검증됐을 때만 `realm`을 포함한다. 컨테이너·행의 이름과 전체 키 집합은 정해진 범위로 한정한다. 두 모듈의 버전 번호는 서로 독립이다.
- 식별 문자열은 각각 UTF-8 128바이트 이하, 앞뒤 공백이나 제어/서식 문자를 넣지 않는다. 비교는 Unicode NFC와 대소문자 정규화를 적용한다. 운영은 slug+캐릭터명, 진단은 slug가 없으면 표시 서버명+캐릭터명을 저장 파일 내 후보 키로 사용한다. 같은 표시 서버/이름의 slug 충돌, 중복 후보, 내부 JSON 식별 불일치를 거부한다. 이름 변경, 별도 진단과 운영 스냅샷, 다른 서버는 자동 결합하지 않는다. GUID·BattleTag·계정명·강화 링크를 적재하지 않는다.

## 시각과 호환

- snapshotJson은 가장 최근 성공한 운영 export 원문이다. 월드퀘스트가 없는 최신 기본 export는 동일 캐릭터의 성공한 이전 full을 worldQuestSnapshotJson에 보존할 수 있다. full이 현재 snapshotJson에 이미 있거나, 이전 full이 현재보다 미래이거나, 신원이 다르면 함께 저장하지 않는다. 웹은 이전 full을 원래 시각의 참고로만 표시하고, 주 JSON에 보상을 삽입하지 않는다. 이전 full은 별도 다운로드한다.
- lastExport의 식별은 내부 JSON을 검증한다. v1 행 중복 시 캐릭터별 행이 우선한다. 다른 캐릭터의 정상 legacy 사본은 최대 16명 한도 안에서 별도 후보로 표시한다. 여러 파일의 같은 종류·slug/표시명·캐릭터는 원래 시각 기준 최신본을 선택하며 동시각에는 선택 목록의 첫 파일을 유지한다. 이때 내용을 서로 합치지 않는다.
- 실패·취소·손상·상한·지원하지 않는 버전은 기존 정상 기록을 덮지 않는다. 웹은 원본을 읽기 전용으로 취급한다. WoW의 로그아웃, 정상 종료, 재장전 등 실제 파일 기록 이후 선택한다. 파일 시스템 자동 감시와 지속 저장은 범위 밖이다.

## 크기, 문법 및 전송

- 운영 JSON 각 256 KiB, 강화 JSON 64 KiB. 컨테이너별 전체 JSON UTF-8 합 2 MiB(중복 호환 사본도 계산). 바깥 Lua 파일은 이스케이프 팽창을 감안해 파일당 10 MiB까지 읽으며 웹에서 한 번에 8개/20 MiB를 허용한다. Lua 중첩 32, 필드 10,000, 개별 디코딩 문자열은 최대 JSON 크기로 제한한다. 기존 파일 실제 크기와 문자 이스케이프는 실측 후 재검토한다.
- 지원 문법은 단일 정해진 전역 변수 할당, 테이블, 인용 문자열, 정수 범위 안의 유한 숫자, boolean/nil, 단일 행 주석, CRLF/BOM이다. WoW 인용 문자열의 표준 백슬래시·개행·십진 바이트 이스케이프를 처리한다. 함수, 식, 호출, 후행 코드, 긴 블록 문자열/주석, 중복 키, 희소 컨테이너 배열 및 프로토타입 공개 키를 거부한다. 파일의 Lua를 실행하지 않는다.
- 운영 다운로드는 기존 파서의 allowlist와 검증을 거친 snapshot-v1 JSON이다. 원시 장비 링크 및 가져오기 내부 필드를 제외한다. 강화 다운로드는 검증된 독립 진단 JSON이다. 다운로드 파일명에 캐릭터명을 삽입하지 않는다. 입력은 브라우저 메모리 및 명시적 로컬 다운로드에서만 사용한다. 원본·신원·잔액을 서버, 로그, Git 및 배포 번들에 넣지 않는다.

애드온 담당 인수 검증은 실제 두 캐릭터 저장, reload 후 파일 및 legacy 마이그레이션 확인, 실패/버전/상한/원시 문자, Lua 5.1/5.4, 실게임 웹 교차, ZIP·사용자 승인이다. 공개 저장소에는 합성 예제만 사용한다.
