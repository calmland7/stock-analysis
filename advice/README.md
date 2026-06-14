# 적중률 추적 기능 — 설치 가이드

Supabase + Vercel 환경에 그대로 붙이는 순서입니다.

## 파일 구성
| 파일 | 용도 |
|------|------|
| `01_schema.sql` | predictions 테이블 + 자동계산 view 생성 |
| `02_seed.sql` | 기존 7개 리포트 입력 |
| `api/record.js` | (Pages Router용) 적중률 API |
| `api/route.js` | (App Router용) 적중률 API — 둘 중 하나만 사용 |
| `record.html` | 적중률 표시 화면 |

## 설치 순서

### 1) DB 생성
Supabase 대시보드 → SQL Editor에서 `01_schema.sql` → `02_seed.sql` 순서로 실행.

### 2) 패키지 (이미 있으면 생략)
```
npm install @supabase/supabase-js
```

### 3) 환경변수 (Vercel → Settings → Environment Variables)
```
SUPABASE_URL          = https://xxxx.supabase.co
SUPABASE_SERVICE_KEY  = (Settings → API → service_role 키, 절대 프론트 노출 금지)
```

### 4) API 배치
- Pages Router 프로젝트면 → `api/record.js` 를 `/api/record.js` 로 복사
- App Router 프로젝트면 → `api/route.js` 를 `/app/api/record/route.js` 로 복사
- (둘 중 하나만)

### 5) 화면 배치
- 순수 정적이면 `record.html` 을 `/public/record.html` 로 복사 → `/record.html` 로 접속
- 메인 페이지에 링크 한 줄 추가:
  `<a href="/record.html">📊 적중률 보기</a>`

## 운영 (한 달에 한 번)
1. 새 리포트 쓸 때마다 predictions에 1행 추가 (Supabase Table Editor)
2. 검증일 지난 종목은 네이버/야후로 종가 확인 → `실제가` 칸만 입력
3. 끝. 적중·수익률은 view가 자동 계산

## 적중 기준 (중요)
현재 view 기준:
- 목표가_3m 이 있으면 → 실제가 ≥ 목표가 면 적중
- 목표가가 없으면 → 실제가 > 진입가 면 적중

기준을 바꾸려면 `01_schema.sql` 의 view `case when` 부분만 수정하면 됩니다.

## 데이터 보정 필요
`02_seed.sql` 에서 PKC(06-08) 외 6건은 진입가/목표가/손절가가 null입니다.
각 리포트를 열어 실제 수치로 채워주세요. (메인 화면만으로는 정확값 확인 불가)
