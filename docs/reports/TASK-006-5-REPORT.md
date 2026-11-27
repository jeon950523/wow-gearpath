# TASK-006-5 — 공개 시즌 팩 검수

웹 시작 main c628bf0735704ccd57966da07799ef2a3d76e931. 애드온 main 48ec8d4e0a1d2b5c45662498d58b74d8f6bd40be, 제작·통합 da3ec293013bac8c173ad300092f852c58a4ba73, 상인 289fa52de7478b700ed564f8ccddf6e15eac83cb, 강화 9a1b7122a340a4c955f327e45d3d0d53b2f3d85d, 전역퀘 c9752c7f540a6baed1795a884ccc54c88539c9d1. 두 저장소 AGENTS/PRODUCT-ROADMAP/SSOT/HANDOFF 및 애드온의 [웹 우선 인계](https://github.com/jeon950523/wow-gearpath-addon/blob/da3ec293013bac8c173ad300092f852c58a4ba73/docs/contracts/SEASON-DATA-WEB-FIRST-HANDOFF.md)와 [첫 실제 파일 보고서](https://github.com/jeon950523/wow-gearpath-addon/blob/da3ec293013bac8c173ad300092f852c58a4ba73/docs/reports/ADDON-006-2-1-first-live-files.md)를 확인했다.

## 공개 카탈로그와 근거

- KR 웹 대상 한밤 2시즌, 패치 12.1.5, 검토 기준 빌드 70961. 각 근거의 지역 및 빌드 확인 수준을 카탈로그에 기록했다. 2026-11-28 확인, 2026-12-03 KST 예정 재검토. 범위가 맞지 않거나 재검토 시각 이후에는 과거/재확인으로 표시한다. 카탈로그는 소비 규칙 활성화와 독립이다.
- 자흐란 용사·영웅은 회전 품목군이며 지하의 주화/Untainted Mana-Crystals의 종류와 등장·해금 후보를 제공한다. 개별 품목별 현재 판매, 실제 수량·재고·골드·직업·특성·적격성은 미확인이다. 다른 시즌 판매 목록과 2,000 지하의 주화 댓글을 적용하지 않았다. [클라이언트 여정](https://thewowdb.com/guides/midnight/delves-season-2/) · [구렁 공개 가이드](https://www.wowhead.com/guide/midnight/delves-season-journey-best-builds-nemesis-rewards)
- 킨도잔 개방은 공식 한국 12.1.5를 우선했다. 와두 교환의 신화 2/6은 최신 공식 요약에 맞췄다. 공식 예시의 파편 6개/장비 2개와 기존 공개 가이드의 개별 3개를 대조했다. 이전 1/6·318과 충돌하므로 현재 KR 아이템 레벨은 비워뒀다. 영웅 파편 3개/308 및 지정 방 8단계는 공개 가이드 수준이다. 파편 ID, 아이템/화폐 유형 및 실제 창을 확정하지 않았다. [한국 공지](https://news.blizzard.com/ko-kr/article/24307306/12-1-5) · [최신 공식 주간 요약](https://news.blizzard.com/en-us/article/24315647/wow-celebration-pass-wow-forever-s-al-aketh-rising-comic-december-trading-post-and-more-in-wow-weekly) · [라이브 미궁 가이드](https://www.wowhead.com/guide/midnight/delves/labyrinth-of-kindojan-megadelve-nemesis-rewards)
- 구렁 일반 보상표 전체를 가져오지 않고 풍요로운 보관함·보물 사냥꾼 보상·금고의 숫자만 해당 시즌 11단계 비교로 정규화했다. 제작은 활과 지팡이 두 공개 주문각인 레시피의 ID, 기본 재료 및 불꽃 슬롯 요구량만 수록했다. 해일의 불꽃 시즌 문맥과 일반 레시피의 불꽃 슬롯을 구분하고, 불꽃 슬롯의 개별 재료 ID·실제 품질·수수료·소비는 추정하지 않는다. [활 레시피](https://www.wowhead.com/spell=1230062/alnhara-sprigshot) · [지팡이 레시피](https://www.wowhead.com/spell=1230060/alnhara-cane)
- [Blizzard 사이트 사용 조건](https://www.blizzard.com/en-us/legal/511dbf9e-2b2d-4047-8243-4c5c65e0ebf1/terms-of-use-for-blizzard-s-websites), [ZAM 약관 안내](https://help.zam.com/support/solutions/articles/27000016858-terms-of-service), [TheWoWDB 약관](https://api.wowgoldfarms.com/terms/)을 확인했다. 원본 DB/아이콘/툴팁/문장·표의 표현은 복사하지 않고 필요한 한정 사실에 직접 출처를 붙였다. 대량 추출·재배포 권한 확인으로 해석하지 않는다.

## 기능·효율 검수

- 기능. 시즌 카탈로그를 상인·강화·제작의 캐릭터별 관측과 별도 표시한다. 캐릭터나 상인 파일이 전혀 없어도 조회할 수 있다. 관측 비교 헬퍼는 캐릭터·패치·빌드·NPC·지도·필터·전문화·전리품 전문화·시각·아이템 ID와 레벨을 확인하고 같은 초 충돌 및 불명 수치를 미확인으로 유지한다. 일치는 근거 보강일 뿐 자격이나 재고 판정이 아니다. 공개 카탈로그 및 대조 경로는 운영 성장 소비 예산에 연결하지 않았다.
- 효율. 웹 정적 시즌 팩과 기존 대시보드 표 스타일을 재사용했다. 외부 조회·폴링·새 의존성·서버 수신을 추가하지 않았다. 오프라인 준비는 동일 Lua 파서·종류별 검증기와 기존 강화 후보 대조를 재사용한다. SavedVariables 선택 UI는 기존 지원 루트만 연다.
- 웹 직접 실행. npm test 164/164, npm run build 성공, 기존 Chromium 헤드리스 E2E 13/13. 번들 내 Blizzard 시크릿·인증 주소·보호 문자열과 CraftSim advisory 종류 검색은 0건이다. GitHub Actions 수동 정책 유지.
- 실제 증거 경계. 애드온 보고의 강화 5건·고객 주문 제작 1건 및 상인 미수집을 검토했다. 사용자 원본은 받지 않았으며 합성 Lua·제작의 0/null/slotState unknown 및 다른 캐릭터 격리, 기존 강화 진단 경로만 검증했다. 실제 파일을 로컬에서 동의 하에 재검증할 때 명시적으로 선택한 캐릭터와 원래 시각을 유지한다. 동일 itemId를 장비 인스턴스에 확정 연결하지 않는다. 본 TASK-007과 애드온 담당 범위를 유지한다.
