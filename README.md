# Scoreyard

브라우저에서 바로 돌아가는 레트로 아케이드 슈팅 게임입니다. 빌드 도구도, 런타임 의존성도 없이 정적 파일로만 동작하며, 점수·프로필은 브라우저(IndexedDB)에 저장됩니다.

드론을 조종해 크리스털을 모으고, 콤보를 쌓고, 7종 파워업을 활용해 **Core Warden** 보스를 깨는 75초 도전 게임입니다.

## 핵심 기능

- **데일리 챌린지** — 오늘 날짜(UTC)로 시드된 맵. 같은 날에는 누구나 *같은 아레나*를 플레이하므로 점수가 공정하게 비교됩니다. ("오늘 거 했어?" 의 리텐션 루프)
- **프리 플레이** — 매판 무작위 아레나로 무제한 연습.
- **최고기록 추적** — 올타임 베스트 + 오늘의 베스트(날짜별). 신기록 시 "NEW BEST!" 연출과 사운드.
- **최고기록 페이스** — 데일리 진행 중 HUD에 내 베스트 대비 실시간 차이 표시(`+320` 앞섬 / `−150` 뒤짐). 부호로 의미를 전달해 색맹 안전.
- **사운드** — WebAudio로 합성한 효과음(에셋 파일 0개). 수집·파워업·피격·보스·신기록·시작. 우상단 음소거 토글(설정 저장).
- **공유 문자열** — 데일리 후 복사용 결과 텍스트 생성(날짜·점수·콤보·이모지 바). **이름/이메일 같은 개인정보는 절대 포함하지 않음.**
- **히트스톱** — 피격·보스 타격·보스 격파 순간 프레임을 짧게 멈춰 타격감을 살림.
- **레트로 아케이드 비주얼** — 네온 틸 팔레트, 스캔라인 그리드, 파티클·충격파·화면 흔들림, 모노스페이스 HUD.

## 기술 구성

- **빌드 없음 / 의존성 0** — 정적 파일을 그대로 서빙. `package.json`은 오직 `node --test`(ES 모듈) 실행용 설정일 뿐, 런타임 패키지를 설치하지 않습니다.
- **ES 모듈 구성** — `index.html`이 `app.js`를 `<script type="module">`로 로드합니다.
  - `rng.js` — 시드 난수기(mulberry32 싱글톤). 게임플레이 난수는 여기로, 장식용 난수(별·파티클·화면흔들림)는 `Math.random` 유지.
  - `seed.js` — UTC 날짜 → 결정론적 시드(`YYYY-MM-DD` 기반).
  - `store.js` — 프로필/최고기록 순수 변환 로직(마이그레이션 포함, IndexedDB 호출은 `app.js`에).
  - `share.js` — 공유 문자열 생성(개인정보 미포함).
  - `pace.js` — 베스트 런 대비 페이스 계산.
  - `audio.js` — WebAudio 합성 효과음 + 음소거.
  - `app.js` — 게임 루프, 렌더, 입력, IndexedDB, DOM 연결.
- **저장소** — IndexedDB(`scoreyard-sites-storage`, v2). `scores`·`profile` 스토어. 구버전 레코드는 읽을 때 새 필드를 기본값으로 채워 자동 마이그레이션.

## 테스트

순수 로직(난수·시드·최고기록·공유·페이스)은 의존성 없이 Node 내장 러너로 테스트합니다.

```bash
npm test
# 또는
node --test test/*.test.js
```

현재 **37개 테스트 통과** — 시드 결정론(같은 시드 → 같은 시퀀스), UTC 날짜 경계, 최고기록 갱신, 공유 문자열의 개인정보 미포함, 페이스 계산 등을 검증합니다.

브라우저 전용 동작(실제 사운드, IndexedDB 마이그레이션, 히트스톱 감각)은 직접 플레이로 확인하세요.

## 로컬 실행

ES 모듈은 `file://`에서 막히므로 간단한 HTTP 서버로 띄웁니다.

```bash
python3 -m http.server 51873 --bind 127.0.0.1
```

그 다음 브라우저에서:

```text
http://127.0.0.1:51873/
```

조작: WASD / 방향키 / 드래그로 이동.

## 배포

정적 사이트입니다. 저장소 루트를 퍼블리시 디렉터리로, `index.html`을 진입점으로 배포하면 됩니다. 빌드 단계가 없습니다.

## 에셋 (`assets/`)

생성된 이미지 자산입니다. 각 스프라이트에는 투명 처리 전의 크로마키 원본(`*-source-magenta.png`)이 함께 보존돼 있습니다.

- `arena-backdrop.png` — 아레나 배경
- `arena-backdrop-nebula.png` — 청록 성운 안개 아레나 배경
- `arena-backdrop-station.png` — 어두운 잔해·광석 아레나 배경
- `arena-backdrop-solar.png` — 골드 에너지 먼지 아레나 배경
- `player-drone.png` — 플레이어 드론
- `enemies.png` — 적 스프라이트 시트(체이서·대셔·오비터·센티넬)
- `boss-core.png` — Core Warden 보스
- `boss-variants.png` — 생성형 2x2 Core Warden 보스 변형 아틀라스
- `boss-variants-source-magenta.png` — `boss-variants.png` 투명 처리 전 크로마키 원본
- `arena-props.png` — 생성형 4x3 장식 아레나 소품 아틀라스
- `arena-props-source-magenta.png` — `arena-props.png` 투명 처리 전 크로마키 원본
- `combat-fx.png` — v2 전투용 4x3 볼트·피격·쉴드·미니오브 이펙트 아틀라스
- `combat-fx-source-magenta.png` — `combat-fx.png` 투명 처리 전 크로마키 원본
- `powerups.png` — 파워업 스프라이트 시트
- `sprites.png` — 크리스털·실드·해저드·스파클 시트
- `variety-atlas.png` — 플레이어·크리스털·적·파워업 변형 스프라이트 아틀라스
- `variety-atlas-source-magenta.png` — `variety-atlas.png` 투명 처리 전 크로마키 원본
- `retro-home-frame.png` — 레트로 홈 프레임
- `retro-ui-kit.png` — 레트로 UI/UX 4x4 버튼·스코어·게이지 아틀라스
- `ui/*.png` — `retro-ui-kit.png`에서 잘라낸 개별 UI 에셋(사용 중인 것만 유지)

## 게임플레이

- **파워업:** 실드, 마그넷, 타임 샤드, 리페어, 펄스 밤, 스코어 부스트, 페이즈.
- **적:** 기본 지뢰, 체이서, 경고선이 있는 대셔, 오비터, 보스 레이저 스윕.
- **보스 페이즈:** 후반(약 52초)에 Core Warden 등장. 크리스털을 모아 데미지를 주면 큰 점수 보너스.
