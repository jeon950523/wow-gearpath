# 데이터 출처 및 검증 기록

검증일: 2026-11-26 (Asia/Seoul). 검색 결과의 상대 날짜 대신 공지 본문의 한국 지역 일정을 우선했습니다. 베타·PTR·과거 시즌 수치를 운영 규칙으로 채택하지 않았습니다.

## 확인된 공식 사실

| 근거 | 확인한 범위 | 적용 |
| --- | --- | --- |
| [한국 2시즌 공지](https://news.blizzard.com/ko-kr/article/24294369/pvp-2) | 한밤 2시즌, 한국 8월 20일 주간 신화+·풍요로운 구렁/열쇠·금고 장비 개방 | 시즌 식별과 경로 분류 |
| [한국 12.1.5 공지](https://news.blizzard.com/ko-kr/article/24307306/12-1-5) | 10월 21일 문장 상한 해제, 퀘스트 후 승천의 맹독석 해금, 11레벨 풍요로운 구렁 등 획득처, 10개로 특정 장비 추가 강화 | 조건부 후보; 완전한 비용 계산 없음 |
| [Blizzard OAuth 공식 샘플](https://github.com/Blizzard/oauth-client-sample) | 앱 등록·client ID/secret·OAuth 구조 | 인증 설계 근거 |
| [Blizzard Node 공식 샘플](https://github.com/Blizzard/node-signature-generator) | 서버의 Client Credentials 흐름 | 로컬 서버 측 인증 방향 |

한국 12.1.5 공지의 추가 강화 대상은 최대로 강화된 2시즌 영웅/신화 또는 최고급 해일제작 무기·장신구·목걸이입니다. 필요한 재료 10개는 확인했지만, 장비별 추가 레벨·모든 예외·보유 장비 적용 가능성을 아직 검증하지 않아 소비 추천을 내지 않습니다. 금고 보상은 즉시 확정 획득과 분리해야 합니다.

미국 공지의 8월 18일 및 10월 20일 날짜를 한국 시작일로 사용하지 않습니다. 최신 시즌 종료일/다음 시즌 개시일은 이 작업에서 확정하지 않았습니다. 시즌 팩의 재검토 시한은 운영상 안전장치이며 공식 일정이 아닙니다.

## 공식 API 검증 상태

공식 진입점: [Profile APIs](https://develop.battle.net/documentation/world-of-warcraft/profile-apis), [Game Data APIs](https://develop.battle.net/documentation/world-of-warcraft/game-data-apis), [OAuth](https://develop.battle.net/documentation/guides/using-oauth).

이 환경에서 공식 문서는 리디렉션/접근 제한 또는 내용 없는 동적 페이지로 반환되어 최신 전체 스키마를 직접 확인하지 못했습니다. 다음은 **실조회 전의 연결 계약 가정**이며, 통합 검증 완료 표시가 아닙니다.

| 경로 / 구분 | 기대 데이터 | 검증 잔여 |
| --- | --- | --- |
| `POST https://oauth.battle.net/token` | 앱 액세스 토큰, 유효기간 | 실제 KR 앱 자격증명·권한 확인 |
| `https://kr.api.blizzard.com/profile/wow/character/{realm-slug}/{name}` | 캐릭터 ID·이름·로그인 시각·표시 평균 | 응답 필드·공개 상태 확인 |
| 위 경로 + `/equipment` | `equipped_items`, 슬롯, 아이템 ID, `level.value`, 무기 유형 | 실장비·게임 UI와 대조 |
| `namespace=profile-kr&locale=ko_KR` | 한국 리테일 프로필 및 현지화 | 실제 호출 계약 검증 |
| Game Data의 아이템 정보 | 아이템 정의 및 기본 정보 후보 | 인스턴스 강화 상태의 대체값으로 사용 금지 |
| 보호 프로필/계정 목록 | 사용자 승인 기반 추가 정보 후보 | 현 MVP 범위 밖 |

보유 가방/은행 아이템, 모든 재화 잔액, 열쇠, 쐐기돌, 이번 주 금고 진행을 공개 장비 API로 얻는다고 가정하지 않습니다. **모든 공식 API에서 절대 미지원이라는 검증을 완료한 것은 아닙니다.** MVP에서는 이 값을 수동/애드온 경로로 취급합니다. 공개 프로필 응답에 트랙 전용 필드가 보장된다고 주장하지 않습니다.

실제 호출은 아직 없고 가짜 응답으로 KR URL·한글 인코딩·인증 헤더·토큰 캐시·오류 경로를 확인했습니다. 실패 응답은 원문 대신 상태만 표시해 비밀값이 출력되지 않게 했습니다. API 가져온 시각과 마지막 로그인 시각은 다르며, 어댑터는 후자를 보수적으로 사용합니다. 이는 서버 자료 갱신을 증명하는 시각은 아닙니다.

## 보류한 표

트랙별 전체 레벨 배열, 단계별 문장/골드 비용, 전투부대 할인·슬롯 최고 기록, 교환 조건, 구렁 각 단계의 기본/풍요/지도 보상, 금고 단계 및 조건, 레이드 우두머리별 예외, 제작 품질·촉매·주간 제한은 완전한 1차 근거가 필요합니다. 일반 공지의 콘텐츠 존재만으로 수치를 계산하지 않습니다.

`src/rules.mjs`의 운영 `upgradeRules`는 빈 배열입니다. `demoRules`의 `DEMO` 트랙 및 `demoCrest`는 오직 가상 테스트 값입니다. 실제 시즌 이름과 함께 보이더라도 공식 보상표가 아닙니다.
