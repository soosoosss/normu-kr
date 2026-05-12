# NORMU - normu.kr 배포 가이드

## 🚀 빠른 배포 (5분 완성)

### 방법 1: Vercel (추천 ⭐)

1. **Vercel 가입**
   - https://vercel.com 접속
   - GitHub 계정으로 가입

2. **프로젝트 배포**
   ```bash
   # 이 폴더를 GitHub에 업로드하거나
   # Vercel에 드래그 앤 드롭
   ```
   - Vercel 대시보드에서 "Add New" → "Project"
   - 이 폴더를 드래그 앤 드롭 또는 GitHub 연동
   - 자동으로 빌드 & 배포됨

3. **커스텀 도메인 연결**
   - Vercel 프로젝트 → Settings → Domains
   - `normu.kr` 입력
   - 안내에 따라 DNS 설정:
     ```
     Type: A
     Name: @
     Value: 76.76.21.21
     
     Type: CNAME
     Name: www
     Value: cname.vercel-dns.com
     ```

### 방법 2: Netlify

1. **Netlify 가입**
   - https://netlify.com 접속
   - GitHub 계정으로 가입

2. **배포**
   - "Add new site" → "Deploy manually"
   - 이 폴더를 드래그 앤 드롭

3. **도메인 연결**
   - Site settings → Domain management
   - Add custom domain → `normu.kr`
   - DNS 설정:
     ```
     Type: A
     Name: @
     Value: 75.2.60.5
     
     Type: CNAME  
     Name: www
     Value: [your-site].netlify.app
     ```

## 🖥️ 로컬 테스트

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000 열기

## 📁 프로젝트 구조

```
normu-deploy/
├── src/
│   ├── App.jsx          # 메인 애플리케이션
│   └── main.jsx         # React 엔트리
├── public/
│   └── favicon.svg      # 파비콘
├── index.html           # HTML 템플릿
├── package.json         # 의존성
├── vite.config.js       # Vite 설정
└── vercel.json          # Vercel 설정
```

## ✅ 완료 체크리스트

- [ ] Vercel/Netlify 가입
- [ ] 프로젝트 배포
- [ ] normu.kr DNS 설정
- [ ] HTTPS 자동 적용 확인
- [ ] 모바일 테스트

## 💡 팁

- **HTTPS**: Vercel/Netlify는 자동으로 SSL 인증서 발급
- **속도**: CDN이 자동으로 적용되어 전세계 어디서나 빠름
- **무료**: 개인 프로젝트는 완전 무료

## 🆘 문제 해결

**DNS 설정이 반영 안될 때**
- DNS 변경은 최대 24-48시간 소요
- https://www.whatsmydns.net 에서 전파 확인

**빌드 에러 날 때**
- Node.js 18 이상 사용 확인
- `npm install` 다시 실행

**도메인이 구매한 곳**에 따라 DNS 설정 방법이 다를 수 있습니다:
- 가비아, 호스팅케이알 등 한국 업체
- GoDaddy, Namecheap 등 해외 업체
각 업체 관리 페이지에서 "DNS 설정" 또는 "네임서버 설정" 찾기
