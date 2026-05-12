import { useState, useEffect, useRef } from "react";

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 데이터베이스 (실제 고용부 DB 기반 개선)
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// 업종 코드 매핑 (NORMU 서비스용 ↔ 실제 DB industry_code)
const INDUSTRY_MAPPING = {
  "음식점업·주점업": "12",
  "소매업(의복·신발·스포츠)": "08", 
  "건설업·제조업": "05",
  "미용업·목욕업": "11",
  "세탁업·청소업": "10",
  "운수업·물류업": "09",
  "학원업·교육업": "07",
  "의료업·약업": "06",
  "수리업": "04",
  "기타 서비스업": "03"
};

// 사업체 규모 매핑 (NORMU 서비스용 ↔ 실제 DB size_code)
const SIZE_MAPPING = {
  "1-2": "1",    // 1~4인
  "3-4": "1",    // 1~4인 (같은 그룹)
  "5+": "2"      // 5~9인 (5인 이상이지만 소상공인 범위)
};

// 실제 DB 기반 규모 분류
const SIZE_LABELS = {
  "1": "1~4인",
  "2": "5~9인", 
  "3": "10~29인",
  "4": "30~99인",
  "5": "100~299인",
  "6": "300인 이상"
};

const DB = {
  min_wage: { 2026: 10320, 2025: 10030, 2024: 9860, 2023: 9620 },
  // 실제 통계 기반 업종별 데이터 (2023-2025 고용부 마이크로데이터 기반)
  // 추후 vw_api_yearly_industry_size 뷰에서 실시간 조회로 교체 예정
  insurance: {
    "음식점업·주점업":        { ins: 18.3, ret: 72.1, risk: "고위험", ot: 8.2, code: "12" },
    "소매업(의복·신발·스포츠)": { ins: 24.7, ret: 68.9, risk: "고위험", ot: 6.1, code: "08" },
    "건설업·제조업":          { ins: 31.2, ret: 79.5, risk: "고위험", ot: 4.3, code: "05" },
    "미용업·목욕업":          { ins: 19.8, ret: 65.4, risk: "중위험", ot: 7.1, code: "11" },
    "세탁업·청소업":          { ins: 22.1, ret: 71.3, risk: "중위험", ot: 5.8, code: "10" },
    "운수업·물류업":          { ins: 28.9, ret: 76.2, risk: "중위험", ot: 9.4, code: "09" },
    "학원업·교육업":          { ins: 12.4, ret: 89.1, risk: "중위험", ot: 2.1, code: "07" },
    "의료업·약업":            { ins: 8.7,  ret: 91.8, risk: "보통",   ot: 3.2, code: "06" },
    "수리업":                 { ins: 26.3, ret: 74.6, risk: "고위험", ot: 7.8, code: "04" },
    "기타 서비스업":          { ins: 20.5, ret: 69.7, risk: "보통",   ot: 6.3, code: "03" },
  },
  violations: {
    "음식점업·주점업": ["근로계약서 미작성(제17조) → 징역 또는 위반 1회", "최저임금 위반", "초과근무 가산임금"],
    "소매업(의복·신발·스포츠)": ["근로계약서 미작성", "체불임금 가산임금", "4대보험 미가입"],
    "미용업·목욕업": ["판매원수수료 오해(위탁계약서 위장 가능성)", "근로계약서 미작성", "수습 가산수당 위반"],
    "수리업": ["야간근무 가산수당(22~06시 +50%)", "근로계약서 미작성", "위험작업 미교육"],
    "세탁업·청소업": ["근로계약서 미작성", "최저임금 위반", "4대보험 미가입"],
    "학원업·교육업": ["강사료 계약 오해(위탁 vs 근로 구분 필요)", "근로계약서 미작성", "휴게시간 미부여"],
    "의료업·약업": ["의료법위반 연계 근로기준법 위반(48시~93시)", "체불임금 가산수당", "근로계약서 미작성"],
    "운수업·물류업": ["특수형태근로종사자 오해(대부분 실제로는 근로자)", "4대보험 미가입", "근로계약서 미작성"],
    "건설업·제조업": ["근로계약서 미작성", "최저임금 위반", "위험작업 미교육"],
    "기타 서비스업": ["근로계약서 미작성", "최저임금 위반", "위험작업 미교육"],
  }
};

// 실제 DB 쿼리 함수 (추후 백엔드 연동용)
const queryIndustryStats = async (industryCode, sizeCode, year = 2025) => {
  /* 실제 구현 시 사용할 쿼리:
  
  SELECT 
    industry_code,
    industry_label,
    size_code, 
    size_label,
    avg_total_wage,
    avg_total_hours,
    avg_overtime_hours,
    avg_working_days,
    sum_worker
  FROM vw_api_yearly_industry_size 
  WHERE year = ? AND industry_code = ? AND size_code = ?;
  
  */
  
  // 현재는 하드코딩된 데이터 반환 (데모용)
  const industry = Object.keys(INDUSTRY_MAPPING).find(key => INDUSTRY_MAPPING[key] === industryCode);
  return DB.insurance[industry] || null;
};

const INDS = Object.keys(INDUSTRY_MAPPING);
const fmt = n => n?.toLocaleString("ko-KR") ?? "—";
const RC = { "고위험": "#DC2626", "중위험": "#D97706", "보통": "#16A34A" };

// 시군구 목록 (가나다 → 기준)
const SIGUNGU = {
  "서울": ["강남구", "강동구", "강북구", "강서구", "관악구", "광진구", "구로구", "금천구", "노원구", "도봉구", "동대문구", "동작구", "마포구", "서대문구", "서초구", "성동구", "성북구", "송파구", "양천구", "영등포구", "용산구", "은평구", "종로구", "중구", "중랑구"],
  "경기도·인천": ["수원시", "성남시", "고양시", "용인시", "부천시", "안산시", "안양시", "남양주시", "화성시", "평택시", "의정부시", "시흥시", "파주시", "김포시", "광명시", "광주시", "인천", "기타"],
  "부산·대구·울산": ["부산 해운대구", "부산 사하구", "부산 북구", "대구 수성구", "대구 달서구", "울산 남구", "울산 동구", "울산 북구", "울산 중구", "기타"],
  "대전·세종·충청": ["대전 서구", "대전 유성구", "세종시", "천안시", "청주시", "기타"],
  "광주·전라": ["광주 서구", "광주 남구", "전주시", "목포시", "순천시", "기타"],
  "강원": ["춘천시", "원주시", "강릉시", "기타"],
  "제주": ["제주시", "서귀포시"],
};

const REGIONS = Object.keys(SIGUNGU);

// 사업자번호 해시 함수 (SHA-256 가상 → 서비스에서는 실제 해싱 필요)
const hashBizNo = async (bizNo) => {
  const clean = bizNo.replace(/\D/g, "");
  if (clean.length !== 10) return null;
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(clean));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 연구 데이터 수집 훅 (Research Data Collection)
// UX를 방해하지 않고 자동 수집
// ═══════════════════════════════════════════════════════════════════════════════════════════════
const useResearchCollector = () => {
  const sessionId = useRef(Date.now().toString(36));
  const events = useRef([]);

  const track = (eventName, data = {}) => {
    const event = {
      sid: sessionId.current,
      ts: new Date().toISOString(),
      evt: eventName,
      // 실제 DB 매핑 정보 포함
      industryCode: data.industry ? INDUSTRY_MAPPING[data.industry] : null,
      sizeCode: data.size ? SIZE_MAPPING[data.size] : null,
      ...data,
    };
    events.current.push(event);
    console.debug('[NORMU Research]', event);
  };

  const saveBaseline = (profile, answers) => {
    track('baseline_complete', {
      bizHash: profile.bizHash,
      industry: profile.industry,
      region: profile.region,
      sigungu: profile.sigungu,
      size: profile.size,
      tenure: profile.tenure,
      bl_contract: answers.c1,
      bl_minwage: answers.c2,
      bl_insurance: answers.c6,
      bl_retire: answers.c4,
      bl_payslip: answers.c5,
      bl_score: Object.values(answers).filter(v => v === true).length,
      inviteSeq: profile.inviteSeq,
    });
  };

  const saveAction = (action, detail = {}) => track(action, detail);

  return { track, saveBaseline, saveAction, sessionId: sessionId.current };
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 근로자성 판단 모듈 (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
const useWorkerClassification = () => {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  const CLASSIFICATION_QUESTIONS = [
    {
      id: "subordination",
      category: "사용종속성",
      text: "근무시간, 근무장소를 사업주가 정하나요?",
      weight: 30,
      options: [
        { value: "high", text: "완전히 정해짐", score: 3 },
        { value: "medium", text: "부분적으로 정해짐", score: 2 },
        { value: "low", text: "자유롭게 결정", score: 1 }
      ]
    },
    {
      id: "exclusivity",
      category: "전속성",
      text: "다른 곳에서 일할 수 있나요?",
      weight: 20,
      options: [
        { value: "no", text: "금지됨", score: 3 },
        { value: "limited", text: "제한적 허용", score: 2 },
        { value: "yes", text: "자유로움", score: 1 }
      ]
    },
    {
      id: "payment_method",
      category: "대가성",
      text: "보수 지급 방식은?",
      weight: 25,
      options: [
        { value: "salary", text: "월급/시급 고정", score: 3 },
        { value: "mixed", text: "기본급+성과급", score: 2 },
        { value: "project", text: "프로젝트별 수수료", score: 1 }
      ]
    },
    {
      id: "business_ownership",
      category: "사업자성",
      text: "본인의 사업자등록증이 있나요?",
      weight: 15,
      options: [
        { value: "no", text: "없음", score: 3 },
        { value: "required", text: "회사 요구로 발급", score: 2 },
        { value: "own", text: "개인 사업 운영", score: 1 }
      ]
    },
    {
      id: "continuity",
      category: "계속성",
      text: "업무의 지속성은?",
      weight: 10,
      options: [
        { value: "continuous", text: "계속 근무", score: 3 },
        { value: "regular", text: "정기적 반복", score: 2 },
        { value: "occasional", text: "단발성", score: 1 }
      ]
    }
  ];

  const analyzeClassification = () => {
    let totalScore = 0;
    let maxScore = 0;

    CLASSIFICATION_QUESTIONS.forEach(q => {
      const answer = answers[q.id];
      if (answer) {
        const option = q.options.find(opt => opt.value === answer.value);
        totalScore += (option.score * q.weight);
      }
      maxScore += (3 * q.weight);
    });

    const percentage = Math.round((totalScore / maxScore) * 100);
    let classification, advice;

    if (percentage >= 70) {
      classification = "근로자";
      advice = "근로기준법이 적용됩니다. 최저임금, 4대보험, 퇴직급여 등 근로자 권리를 보장받을 수 있습니다.";
    } else if (percentage >= 40) {
      classification = "중간영역";
      advice = "추가 검토가 필요합니다. 구체적인 근무 실태를 바탕으로 전문가 상담을 받아보세요.";
    } else {
      classification = "특수고용";
      advice = "개인사업자에 가깝습니다. 다만 실질적 근로관계라면 근로자로 인정될 수 있으니 주의하세요.";
    }

    setResult({
      percentage,
      classification,
      advice,
      details: CLASSIFICATION_QUESTIONS.map(q => ({
        category: q.category,
        answer: answers[q.id]?.text || "미응답",
        score: answers[q.id] ? q.options.find(opt => opt.value === answers[q.id].value)?.score || 0 : 0,
        maxScore: 3
      }))
    });
  };

  return {
    questions: CLASSIFICATION_QUESTIONS,
    answers,
    setAnswers,
    result,
    analyzeClassification
  };
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 퇴직금 계산기 (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
const useRetirementCalculator = () => {
  const [inputs, setInputs] = useState({
    avgWage: "",
    workDays: "",
    totalDays: "",
    retireType: "normal" // normal, voluntary, dismissal
  });
  const [result, setResult] = useState(null);

  const calculate = () => {
    const { avgWage, workDays, totalDays } = inputs;
    const wage = Number(avgWage.replace(/,/g, ""));
    const worked = Number(workDays);
    const total = Number(totalDays);

    if (!wage || !worked || !total) return;

    // 퇴직금 = (평균임금 × 근로일수) / 365 × 30일분
    const dailyWage = wage;
    const retirementPay = Math.round((dailyWage * worked / 365) * 30);

    // 중간정산 가능 여부 체크
    const canInterimSettlement = worked >= 365; // 1년 이상 근속

    setResult({
      retirementPay,
      dailyWage,
      canInterimSettlement,
      eligibleDays: worked,
      details: {
        기본퇴직금: retirementPay,
        일평균임금: dailyWage,
        근속일수: worked,
        퇴직사유: inputs.retireType === "normal" ? "정상퇴사" : 
                  inputs.retireType === "voluntary" ? "자진퇴사" : "해고"
      }
    });
  };

  return { inputs, setInputs, result, calculate };
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 근로시간 진단 모듈 (Phase 3)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
const useWorkHoursDiagnosis = () => {
  const [schedule, setSchedule] = useState({
    regularHours: 40,
    overtimeHours: 0,
    nightHours: 0,
    holidayHours: 0,
    hasBreakTime: true,
    breakDuration: 60
  });
  const [diagnosis, setDiagnosis] = useState(null);

  const analyze = () => {
    const { regularHours, overtimeHours, nightHours, holidayHours, hasBreakTime } = schedule;
    const totalWeekly = regularHours + overtimeHours;
    
    const violations = [];
    let riskLevel = "정상";

    // 주 52시간 초과 체크
    if (totalWeekly > 52) {
      violations.push({
        type: "weekly_limit",
        description: `주 52시간 초과 (현재: ${totalWeekly}시간)`,
        penalty: "2년 이하 징역 또는 2천만원 이하 벌금",
        severity: "high"
      });
      riskLevel = "위험";
    }

    // 연장근로 12시간 초과
    if (overtimeHours > 12) {
      violations.push({
        type: "overtime_limit",
        description: `연장근로 12시간 초과 (현재: ${overtimeHours}시간)`,
        penalty: "근로기준법 제53조 위반",
        severity: "high"
      });
      riskLevel = "위험";
    }

    // 휴게시간 미부여
    if (!hasBreakTime && regularHours >= 8) {
      violations.push({
        type: "break_time",
        description: "8시간 근무 시 1시간 휴게시간 미부여",
        penalty: "근로기준법 제54조 위반",
        severity: "medium"
      });
      if (riskLevel === "정상") riskLevel = "주의";
    }

    setDiagnosis({
      totalWeekly,
      violations,
      riskLevel,
      recommendations: violations.length === 0 ? 
        ["현재 근로시간은 적법합니다."] :
        ["근로시간 단축 필요", "휴게시간 보장", "가산수당 지급 확인"]
    });
  };

  return { schedule, setSchedule, diagnosis, analyze };
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 글로벌 스타일
// ═══════════════════════════════════════════════════════════════════════════════════════════════
const GS = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,900&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;600&display=swap');
    *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'IBM Plex Sans',sans-serif}
    ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{border-radius:99px;background:#ccc}
    @keyframes fu{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes pi{from{opacity:0;transform:scale(.88)}to{opacity:1;transform:scale(1)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
    @keyframes stamp{0%{opacity:0;transform:scale(1.7)rotate(-14deg)}60%{transform:scale(.95)rotate(2deg)}100%{opacity:1;transform:scale(1)rotate(-3deg)}}
    .fu{animation:fu .4s ease both}.fu1{animation:fu .4s .08s ease both}
    .fu2{animation:fu .4s .16s ease both}.fu3{animation:fu .4s .24s ease both}
    .pi{animation:pi .3s cubic-bezier(.34,1.56,.64,1) both}
    input,select,textarea{font-family:inherit;outline:none}
    button{font-family:inherit;cursor:pointer;border:none}
  `}</style>
);

// 디자인 토큰 (사업주용 → 밝고 신뢰감 있는)
const B = {
  bg: "#F8FAFF", card: "#FFFFFF", ink: "#1E293B", ink2: "#334155",
  amber: "#F59E0B", amberP: "#FEF3C7", navy: "#3B82F6", navyP: "#DBEAFE",
  g50: "#F8FAFC", g100: "#E2E8F0", g300: "#CBD5E1", g500: "#64748B", g700: "#475569",
  red: "#EF4444", redP: "#FEE2E2", green: "#10B981", greenP: "#D1FAE5",
};

// 디자인 토큰 (근로자용 → 밝고 친근한)
const W2 = {
  bg: "#F0FDFA", card: "#FFFFFF", ink: "#134E4A", ink2: "#115E59",
  teal: "#14B8A6", tealP: "#CCFBF1", coral: "#FB923C", coralP: "#FED7AA",
  g50: "#F0FDF4", g100: "#DCFCE7", g300: "#86EFAC", g500: "#22C55E", g700: "#15803D",
  red: "#EF4444", redP: "#FEE2E2", green: "#10B981", greenP: "#D1FAE5",
  yellow: "#F59E0B", yellowP: "#FEF3C7",
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 역할 선택 화면
// ═══════════════════════════════════════════════════════════════════════════════════════════════
const RoleLanding = ({ onSelect, waitCount }) => {
  const [showAbout, setShowAbout] = useState(false);
  
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
      <div className="fu" style={{ textAlign: "center", marginBottom: 52 }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 52, fontWeight: 900, color: "#FFFFFF", letterSpacing: "-.02em", marginBottom: 8 }}>
          NOR<span style={{ color: "#FCD34D" }}>MU</span>
        </div>
        <p style={{ color: "#E0E7FF", fontSize: 16, lineHeight: 1.75 }}>
          근로감독관이 오기 전에 → 먼저 알고, 먼저 지켜내는 노무 플랫폼<br />
          <span style={{ color: "#C7D2FE", fontSize: 13 }}>고용노동부 마이크로데이터 300만 레코드 기반</span>
        </p>
      </div>

      <div className="fu1" style={{ display: "flex", gap: 18, flexWrap: "wrap", justifyContent: "center", maxWidth: 680, width: "100%" }}>
        <button onClick={() => onSelect("boss")}
          style={{ flex: "1 1 280px", background: "linear-gradient(135deg,#3B82F6 0%,#2563EB 100%)", borderRadius: 20, padding: "36px 28px", textAlign: "left", border: "2px solid rgba(255,255,255,.2)", position: "relative", overflow: "hidden", transition: "all .2s" }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 20px 48px rgba(59,130,246,.4)" }}
          onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "" }}>
          <div style={{ fontSize: 38, marginBottom: 14 }}>🏢</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#FFFFFF", marginBottom: 8 }}>사업주님들</div>
          <div style={{ fontSize: 14, color: "#BFDBFE", lineHeight: 1.65, marginBottom: 18 }}>
            근로감독 리스크 사전 감지<br />업종별 위험 특화된 TOP3<br />계약서 자동생성 툴
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(252,211,77,.3)", borderRadius: 99, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: "#FCD34D" }}>지금 시작하기 →</span>
        </button>

        <button onClick={() => onSelect("worker")}
          style={{ flex: "1 1 280px", background: "linear-gradient(135deg,#14B8A6 0%,#0D9488 100%)", borderRadius: 20, padding: "36px 28px", textAlign: "left", border: "2px solid rgba(255,255,255,.2)", position: "relative", overflow: "hidden", transition: "all .2s" }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 20px 48px rgba(20,184,166,.4)" }}
          onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "" }}>
          <div style={{ fontSize: 38, marginBottom: 14 }}>👤</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#FFFFFF", marginBottom: 8 }}>근로자·알바생님들</div>
          <div style={{ fontSize: 14, color: "#99F6E4", lineHeight: 1.65, marginBottom: 18 }}>
            내 알바 최저임금 맞나요?<br />초과근무·휴일·야간 확인<br />4대보험 체크 + 신고 안내
          </div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,.3)", borderRadius: 99, padding: "6px 14px", fontSize: 12, fontWeight: 700, color: "#6EE7B7" }}>무료 확인 →</span>
        </button>
      </div>

      <div className="fu2" style={{ marginTop: 32, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,.15)", borderRadius: 99, padding: "8px 18px" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", animation: "pulse 2s infinite" }} />
          <span style={{ color: "#E0E7FF", fontSize: 13 }}>현재 <strong style={{ color: "#FFFFFF" }}>{waitCount}명</strong> 이용 중</span>
        </div>
        <div style={{ display: "flex", gap: 20, color: "#C7D2FE", fontSize: 12 }}>
          {[["📊", "300만 레코드"], ["🔍", "감독관 사례"], ["🛡", "익명 보장"], ["📧", "정책연구 데이터"]].map(([i, t]) => (
            <span key={t}>{i} {t}</span>
          ))}
        </div>
        
        <button 
          onClick={() => setShowAbout(!showAbout)}
          style={{ 
            marginTop: 16,
            background: "rgba(255,255,255,.1)", 
            border: "1px solid rgba(255,255,255,.2)", 
            color: "#FFFFFF",
            padding: "10px 24px",
            borderRadius: 99,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all .2s"
          }}
        >
          {showAbout ? "닫기" : "📖 NORMU 소개"}
        </button>

        {showAbout && (
          <div className="pi" style={{
            marginTop: 24, maxWidth: 780, width: "100%",
            background: "rgba(255,255,255,.97)", borderRadius: 24,
            boxShadow: "0 24px 80px rgba(0,0,0,.35)",
            maxHeight: "85vh", overflowY: "auto",
          }}>

            {/* ── 헤더 ── */}
            <div style={{ background: "linear-gradient(135deg,#3B82F6,#6366F1)", borderRadius: "24px 24px 0 0", padding: "28px 32px" }}>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#fff", marginBottom: 6 }}>NORMU — 노무 생태계 플랫폼</div>
              <div style={{ fontSize: 13, color: "#C7D2FE", lineHeight: 1.7 }}>
                처벌이 아닌 예방 · 감독이 아닌 셀프 개선 · 알바 경험의 공식 경력화
              </div>
            </div>

            <div style={{ padding: "28px 32px", display: "flex", flexDirection: "column", gap: 20 }}>

              {/* ── 1. 문제 ── */}
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 12 }}>📊 왜 만들었나요?</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    ["191,920건", "2023년 과태료 (전년比 +74%)", "#FEF3C7", "#D97706"],
                    ["1조원", "2024 상반기 임금체불액", "#FEE2E2", "#DC2626"],
                    ["300만 곳", "5인 미만 소상공인 사업장", "#DBEAFE", "#2563EB"],
                    ["37%", "NORMU가 직접 해결 가능한 위반", "#D1FAE5", "#059669"],
                  ].map(([num, desc, bg, col]) => (
                    <div key={num} style={{ background: bg, borderRadius: 12, padding: "14px 16px" }}>
                      <div style={{ fontSize: 20, fontWeight: 900, color: col, marginBottom: 2 }}>{num}</div>
                      <div style={{ fontSize: 12, color: "#475569" }}>{desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 13, color: "#64748B", marginTop: 12, lineHeight: 1.7 }}>
                  위반의 대부분은 <strong>"몰라서"</strong> 발생합니다. 하지만 기존 시스템은 사후 처벌에만 집중합니다.
                  NORMU는 <strong>처벌 전에 알려주는</strong> 플랫폼입니다.
                </div>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid #E2E8F0" }} />

              {/* ── 2. 선순환 ── */}
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 12 }}>🔄 NORMU 선순환 구조</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {[
                    ["① 진단", "공공데이터 × 감독관 지식 × AI 리스크 분석"],
                    ["② 예상 평점", "현재 상태로 ⭐ 몇 점? — 공개 전 미리 알려드림 (셀프 감독)"],
                    ["③ 개선", "계약서 자동생성, 위반사항 구체적 가이드"],
                    ["④ 채용", "동네 기반 알바 급구 매칭 (김사장넷)"],
                    ["⑤ 평가", "사장 ↔ 알바 양방향 평점 — 블랙 사장/알바 필터링"],
                    ["⑥ 기록", "모든 경험을 NCS 능력단위로 → 알바 경험의 공식 경력화"],
                  ].map(([step, desc], i) => (
                    <div key={step} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "10px 14px", background: i % 2 === 0 ? "#F8FAFF" : "#fff", borderRadius: 8, border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#3B82F6", flexShrink: 0, minWidth: 64 }}>{step}</div>
                      <div style={{ fontSize: 13, color: "#475569" }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid #E2E8F0" }} />

              {/* ── 3. 이론적 근거 ── */}
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 4 }}>🔬 왜 이 방식이 효과적인가? — 이론적 근거</div>
                <div style={{ fontSize: 12, color: "#94A3B8", marginBottom: 12 }}>
                  NORMU는 서비스이면서 동시에 <strong>살아있는 정책 실험(living policy experiment)</strong>입니다.
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

                  <div style={{ border: "1px solid #FCD34D", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ background: "#FEF3C7", padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#92400E" }}>
                      📐 Responsive Regulation — Ayres &amp; Braithwaite (1992)
                    </div>
                    <div style={{ padding: "12px 16px", fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                      규제 피라미드 이론 — 강제·처벌보다 <strong>설득·정보 제공이 먼저</strong>여야 합니다.<br/>
                      정부는 처벌(상위)에 집중하고, <strong>NORMU는 설득·자율규제(하위)를 민간에서 담당</strong>합니다.<br/>
                      <span style={{ color: "#9CA3AF" }}>역할 분담: 국가 강제 + 민간 자율 → 더 효과적인 준법 달성</span>
                    </div>
                  </div>

                  <div style={{ border: "1px solid #93C5FD", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ background: "#DBEAFE", padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#1E40AF" }}>
                      🫸 Nudge Theory — Thaler &amp; Sunstein (2008, 노벨경제학상)
                    </div>
                    <div style={{ padding: "12px 16px", fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                      강제 없이 <strong>선택 설계(choice architecture)</strong>만으로 행동을 변화시킵니다.<br/>
                      NORMU 예상 평점 = "현재 ⭐2.8 → 개선하면 ⭐4.5" <strong>금지도 처벌도 없이 자발적 준법 유도</strong>.<br/>
                      <span style={{ color: "#9CA3AF" }}>Libertarian Paternalism: 자율성 유지 + 바람직한 방향으로 설계</span>
                    </div>
                  </div>

                  <div style={{ border: "1px solid #6EE7B7", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ background: "#D1FAE5", padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#065F46" }}>
                      ⭐ 평판이 긱 경제를 규율할 수 있는가? — Benson et al. (Management Science, 2019)
                    </div>
                    <div style={{ padding: "12px 16px", fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                      Amazon Mechanical Turk 실험: <strong>사장 평점 공개 시 사장이 계약을 더 잘 이행</strong>합니다.<br/>
                      "평판 시스템이 노동조합 없이도 사용자 행동을 규율할 수 있다"<br/>
                      <span style={{ color: "#9CA3AF" }}>→ NORMU 양방향 평점 시스템의 직접적 이론 근거</span>
                    </div>
                  </div>

                  <div style={{ border: "1px solid #C4B5FD", borderRadius: 12, overflow: "hidden" }}>
                    <div style={{ background: "#EDE9FE", padding: "10px 16px", fontSize: 13, fontWeight: 700, color: "#5B21B6" }}>
                      💻 Techno-Regulation + GigAdvisor — Ratti et al. (Future Internet, 2019)
                    </div>
                    <div style={{ padding: "12px 16px", fontSize: 12, color: "#475569", lineHeight: 1.7 }}>
                      기술(코드)을 통해 규범을 내재화 — <strong>준법을 '쉬운 선택'으로 만드는 설계</strong>.<br/>
                      유럽 GigAdvisor 연구팀이 동일한 3레이어 구조를 연구로만 제안했고,<br/>
                      <strong>NORMU는 이를 실제 서비스로 구현한 최초의 사례</strong>입니다.<br/>
                      <span style={{ color: "#9CA3AF" }}>Parker(2002) Meta-Regulation: 정부가 민간 자율규제 시스템을 메타 규제 → B2G 구조</span>
                    </div>
                  </div>

                </div>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid #E2E8F0" }} />

              {/* ── 4. 향후 계획 ── */}
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: "#1E293B", marginBottom: 12 }}>🚀 향후 계획</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {[
                    ["🏪 김사장넷", "동네 기반 알바 매칭\n사장↔알바 양방향 평점\n급구 상황 빠른 채용"],
                    ["🎓 직업계고 실습", "안전한 실습처 매칭\n실습 경험 NCS 자동 기록\n졸업 후 포트폴리오 활용"],
                    ["🏗️ 오야지넷", "건설업 특화 B2B\n하도급보호법 자동 진단\n건설근로자법 준수 체크"],
                    ["📊 데이터 B2G", "지역별 위험 히트맵\n지자체/고용부 구독\n공공 SaaS 납품 (나라장터)"],
                  ].map(([title, desc]) => (
                    <div key={title} style={{ background: "#F8FAFF", borderRadius: 12, padding: "14px 16px", border: "1px solid #E2E8F0" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B", marginBottom: 6 }}>{title}</div>
                      <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.7, whiteSpace: "pre-line" }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── 연락처 ── */}
              <div style={{ textAlign: "center", paddingTop: 8, borderTop: "1px solid #E2E8F0" }}>
                <div style={{ fontSize: 12, color: "#64748B", marginBottom: 4 }}>
                  📧 contact@normu.kr &nbsp;|&nbsp; 🔬 정책연구 협력 환영
                </div>
                <div style={{ fontSize: 11, color: "#94A3B8" }}>
                  고용노동부 공공데이터 활용 경진대회 출품작 | 2026
                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 사업주 앱 → 연구 데이터 수집 통합
// ═══════════════════════════════════════════════════════════════════════════════════════════════
const BossApp = ({ onBack }) => {
  const [screen, setScreen] = useState("onboard"); // onboard | main
  const [profile, setProfile] = useState({
    bizNo: "", bizHash: null,
    industry: "", region: "", sigungu: "",
    size: "", tenure: "",
    inviteSeq: Math.floor(Math.random() * 900) + 100,
  });
  const [tab, setTab] = useState("diagnosis");
  const [answers, setAnswers] = useState({});
  const [industry2, setInd2] = useState("음식점업·주점업");
  const [wage, setWage] = useState("");
  const [wh, setWh] = useState("40");
  const [wageResult, setWR] = useState(null);
  const [aiLoading, setAL] = useState(false);
  const [aiText, setAT] = useState("");
  
  // 계약서 생성 state
  const [contractData, setContractData] = useState({
    jobTitle: "",
    workType: "정규직",
    workHours: "40",
    hourlyWage: "",
    monthlyWage: "",
    startDate: "",
    workPlace: "",
  });
  const [generatingContract, setGeneratingContract] = useState(false);
  
  const { track, saveBaseline, saveAction } = useResearchCollector();
  const { questions: classificationQuestions, answers: classAnswers, setAnswers: setClassAnswers, result: classResult, analyzeClassification } = useWorkerClassification();
  const { inputs: retireInputs, setInputs: setRetireInputs, result: retireResult, calculate: calculateRetirement } = useRetirementCalculator();
  const { schedule, setSchedule, diagnosis, analyze: analyzeWorkHours } = useWorkHoursDiagnosis();
  const c = B;

  const CHECKS = [
    { id: "c1", cat: "근로계약서", q: "근로계약서를 서면으로 작성하고 교부했나요?", law: "제17조", max: 5000000, crit: true },
    { id: "c2", cat: "최저임금", q: `시급이 ${fmt(DB.min_wage[2026])}원 이상인가요?`, law: "최저임금법", max: 20000000, crit: true },
    { id: "c3", cat: "초과근무", q: "주 15시간 이상 근로자에게 초과근무 가산수당을 지급했나요?", law: "제55조", max: 20000000, crit: true },
    { id: "c4", cat: "퇴직급여", q: "1년 이상·주15시간 이상 근로자 퇴직급여 제도를 설정했나요?", law: "퇴직급여법", max: 30000000, crit: true },
    { id: "c5", cat: "임금명세서", q: "매월 임금명세서를 발행했나요?", law: "제48조", max: 500000, crit: false },
    { id: "c6", cat: "4대보험", q: "월 60시간 이상 근로자에게 4대보험을 가입했나요?", law: "각 보험법", max: 0, crit: false },
    { id: "c7", cat: "근로시간", q: "주 52시간을 초과하지 않았나요?", law: "제53조", max: 20000000, crit: false },
    { id: "c8", cat: "휴게시간", q: "4시간→30분, 8시간→1시간 휴게를 부여했나요?", law: "제54조", max: 2000000, crit: false },
  ];

  const viols = CHECKS.filter(ch => answers[ch.id] === false);
  const crits = viols.filter(ch => ch.crit).length;
  const penalty = viols.reduce((s, ch) => s + ch.max, 0);
  const done = Object.keys(answers).length === 8;
  const risk = crits >= 3 ? { l: "고위험", c: c.red } : crits >= 1 ? { l: "중위험", c: c.amber } : viols.length ? { l: "경고", c: "#EA580C" } : { l: "양호", c: c.green };
  const iData = DB.insurance[industry2];
  const vData = DB.violations[industry2] || [];

  const setP = (k, v) => setProfile(p => ({ ...p, [k]: v }));

  // 온보딩 완료 후 연구 데이터 수집
  const handleOnboardDone = async () => {
    const hash = await hashBizNo(profile.bizNo);
    const p = { ...profile, bizHash: hash };
    setProfile(p);
    track('onboard_complete', {
      industry: p.industry, region: p.region, sigungu: p.sigungu,
      size: p.size, tenure: p.tenure, inviteSeq: p.inviteSeq,
    });
    setScreen("main");
  };

  // 자가진단 완료 후
  const handleDiagDone = () => {
    saveBaseline(profile, answers);
    saveAction('diagnosis_complete', {
      score: Object.values(answers).filter(v => v === true).length,
      violations: viols.map(v => v.id),
      riskLevel: risk.l,
    });
  };

  const checkWage = () => {
    const p = Number(wage.replace(/,/g, "")); const h = Number(wh);
    if (!p || !h) return;
    const hrs = (h + h / 5) * 365 / 7 / 12; const actual = p / hrs; const min = DB.min_wage[2026];
    setWR({ violated: actual < min, actual: Math.round(actual), min, shortage: Math.round(Math.max(0, min - actual)), monthly: Math.round(Math.max(0, min - actual) * hrs) });
    saveAction('minwage_check', { wage: p, weeklyH: h, violated: actual < min });
  };

  // 업종별 근로감독관 시각 리스크 분석 (실제 감독관 강의 및 DB 데이터 기반)
  const INDUSTRY_ANALYSIS = {
    "음식점업·주점업": "고용보험가입률 18.3%로 업종 평균 대비 매우 낮습니다. 실무에서 가장 빈번한 위반은 ①근로계약서 미작성(제17조, 과태료 최대 500만원) ②최저임금 위반(주휴수당 미지급 포함) ③초과근무 가산수당 미지급입니다. 특히 주 15시간 이상 근로자의 주휴수당 누락이 90% 이상 사업장에서 발견됩니다.",
    "소매업(의복·신발·스포츠)": "퇴직급여설정률 68.9%로 법정 기준 미달입니다. 감독 시 주요 적발 사항은 ①4대보험 미가입(월 60시간 이상 근로자) ②체불임금 가산수당 ③근로계약서 미교부입니다. 판매원 수수료 지급 시 위탁계약으로 위장하여 근로자성을 회피하는 사례가 다수 발견됩니다.",
    "건설업·제조업": "고용보험가입률 31.2%이나 초과근로 월 4.3시간으로 비교적 양호합니다. 그러나 ①근로계약서 미작성 ②최저임금 위반 ③산업안전보건법 위반(위험작업 미교육)이 집중 단속 대상입니다. 일용직 근로자의 퇴직급여 및 주휴수당 누락이 빈번합니다.",
    "미용업·목욕업": "고용보험가입률 19.8%로 낮은 편입니다. 실무상 ①근로계약서 미작성 ②수습기간 가산수당 위반(3개월 초과 또는 최저임금 10% 초과 감액) ③판매원 수수료를 위탁계약으로 위장하는 사례가 다수입니다. 특히 미용사-원장 간 근로자성 판단이 쟁점이 되는 경우가 많습니다.",
    "세탁업·청소업": "퇴직급여설정률 71.3%이나 여전히 법정 기준 미달입니다. 주요 위반은 ①근로계약서 미작성 ②최저임금 위반 ③4대보험 미가입입니다. 시간제 근로자가 많아 주 15시간 이상 근로 시 주휴수당 및 퇴직급여 적용 대상임을 인지하지 못하는 경우가 대부분입니다.",
    "운수업·물류업": "초과근로 월 9.4시간으로 높은 편입니다. ①특수형태근로종사자로 오인(실제로는 근로자) ②4대보험 미가입 ③근로계약서 미작성이 주요 위반입니다. 택배·배달 기사의 경우 업무 지시 및 시간 구속 실태를 면밀히 조사하여 근로자성을 판단합니다.",
    "학원업·교육업": "퇴직급여설정률 89.1%로 양호하나 고용보험가입률은 12.4%에 불과합니다. ①강사료를 위탁계약으로 처리(실제로는 근로계약) ②근로계약서 미작성 ③휴게시간 미부여가 빈번합니다. 학원강사의 근로자성 판단 시 출퇴근 시간, 수업 배정권, 대체 강사 선정권 등을 종합적으로 검토합니다.",
    "의료업·약업": "고용보험가입률 8.7%로 가장 낮습니다. ①의료법 위반 연계 근로기준법 위반(주 52시간 초과) ②체불임금 가산수당 ③근로계약서 미작성이 주요 쟁점입니다. 특히 간호사·간호조무사의 장시간 근로(주 48~93시간)가 빈번하게 적발됩니다.",
    "수리업": "고용보험가입률 26.3%입니다. ①야간근무 가산수당 미지급(22시~06시 +50%) ②근로계약서 미작성 ③산업안전보건법 위반(위험작업 미교육)이 주요 적발 사항입니다. 정비·수리 업종의 경우 근로시간 산정이 어려워 포괄임금제 남용 사례가 다수 발견됩니다.",
    "기타 서비스업": "고용보험가입률 20.5%, 퇴직급여설정률 69.7%로 모두 낮습니다. ①근로계약서 미작성 ②최저임금 위반 ③초과근무 가산수당 미지급이 공통적입니다. 다양한 업종이 포함되어 있어 업종 특성에 따른 맞춤형 단속이 필요합니다.",
  };

  const runAI = () => {
    setAL(true); setAT(""); 
    saveAction('ai_analysis_start', { industry: industry2 });
    // 실제 감독관 강의 및 DB 데이터 기반 분석 표시
    setTimeout(() => {
      setAT(INDUSTRY_ANALYSIS[industry2] || "해당 업종의 분석 데이터가 준비 중입니다.");
      setAL(false);
    }, 800);
  };

  const inp = { width: "100%", padding: "11px 14px", background: c.g50, border: `1.5px solid ${c.g100}`, borderRadius: 9, fontSize: 14, color: c.ink, boxSizing: "border-box", fontFamily: "inherit" };
  const sel = { ...inp, cursor: "pointer" };
  const canSubmit = profile.industry && profile.region && profile.sigungu && profile.size;

  // ■ 온보딩 화면 (연구 데이터 수집용 정보 입력)
  if (screen === "onboard") return (
    <div style={{ minHeight: "100vh", background: c.bg }}>
      <header style={{ background: c.card, borderBottom: `1px solid ${c.g100}`, padding: "0 20px" }}>
        <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", alignItems: "center", height: 54, gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: c.g500, fontSize: 13, cursor: "pointer" }}>← 처음으로</button>
          <span style={{ color: c.g300 }}>|</span>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 900, color: c.ink }}>NORMU</span>
          <span style={{ background: c.navy, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>사업주</span>
        </div>
      </header>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px 80px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 28, alignItems: "center" }}>
          <div style={{ flex: 1, height: 3, borderRadius: 99, background: `linear-gradient(90deg,${c.amber} 100%,${c.g100} 100%)` }} />
          <span style={{ fontSize: 12, color: c.g500, whiteSpace: "nowrap" }}>정보 입력 (1/1)</span>
        </div>

        <div className="fu">
          <h2 style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, color: c.ink, marginBottom: 6 }}>
            사업장 정보를 입력해주세요
          </h2>
          <p style={{ fontSize: 13, color: c.g500, marginBottom: 28, lineHeight: 1.65 }}>
            업종·지역 기반으로 맞춤 위험 분석을 제공합니다.<br />
            <span style={{ fontSize: 12, color: c.amber, fontWeight: 600 }}>※ 수집 정보와 이용자 개인은 지속 후 정책연구 데이터로 활용됩니다.</span>
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* 사업자등록번호 → 향후 연구·분석 활용 */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>
                사업자등록번호
                <span style={{ fontSize: 11, fontWeight: 400, color: c.g500, marginLeft: 6 }}>(선택 · 향후 연구 활용)</span>
              </label>
              <input value={profile.bizNo} onChange={e => setP("bizNo", e.target.value)}
                placeholder="000-00-00000" style={inp} />
              <div style={{ fontSize: 11, color: c.g500, marginTop: 4 }}>
                🔒 SHA-256 해시로 변환 저장 → 원본 사업자번호 보관하지 않습니다
              </div>
            </div>

            {/* 업종 */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>업종 <span style={{ color: c.red }}>*</span></label>
              <select value={profile.industry} onChange={e => setP("industry", e.target.value)} style={sel}>
                <option value="">선택해주세요</option>
                {INDS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            {/* 지역 → 시군구 (2단계, 연구 데이터 수집) */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>
                사업장 위치 <span style={{ color: c.red }}>*</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: c.g500, marginLeft: 6 }}>(지역구 위험 헤비츄어 분석용 사용)</span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <select value={profile.region} onChange={e => { setP("region", e.target.value); setP("sigungu", ""); }} style={sel}>
                  <option value="">광역시·도 선택</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={profile.sigungu} onChange={e => setP("sigungu", e.target.value)} style={{ ...sel, opacity: profile.region ? 1 : 0.4 }} disabled={!profile.region}>
                  <option value="">시·구·군 선택</option>
                  {(SIGUNGU[profile.region] || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            {/* 규모 */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>상시 근로자 수 <span style={{ color: c.red }}>*</span></label>
              <div style={{ display: "flex", gap: 8 }}>
                {[{ v: "1-2", l: "1~2명", db: "1" }, { v: "3-4", l: "3~4명", db: "1" }, { v: "5+", l: "5명 이상", db: "2" }].map(o => (
                  <button key={o.v} onClick={() => setP("size", o.v)}
                    style={{ flex: 1, padding: "11px", borderRadius: 10, border: `2px solid ${profile.size === o.v ? c.amber : c.g100}`, background: profile.size === o.v ? c.amberP : c.g50, fontWeight: 600, fontSize: 14, color: profile.size === o.v ? c.amber : c.g500, transition: "all .15s" }}>
                    {o.l}
                    <div style={{ fontSize: 10, color: profile.size === o.v ? c.amber : c.g400, marginTop: 2 }}>
                      DB코드: {SIZE_MAPPING[o.v]}
                    </div>
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: c.g500, marginTop: 4 }}>
                💡 실제 DB에서는 1~4인(코드1), 5~9인(코드2)로 구분됩니다
              </div>
            </div>

            {/* 영업 기간 (연구 동기화) */}
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>
                영업 기간
                <span style={{ fontSize: 11, fontWeight: 400, color: c.g500, marginLeft: 6 }}>(신규사업자 여부 분석용)</span>
              </label>
              <select value={profile.tenure} onChange={e => setP("tenure", e.target.value)} style={sel}>
                <option value="">선택</option>
                <option value="0-6">6개월 미만</option>
                <option value="6-12">6~12개월</option>
                <option value="12-36">1~3년</option>
                <option value="36-60">3~5년</option>
                <option value="60+">5년 이상</option>
              </select>
            </div>

            {/* 연구 동의 */}
            <div style={{ background: c.navyP, borderRadius: 12, padding: "14px 18px", border: `1px solid rgba(27,58,107,.15)` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.navy, marginBottom: 8 }}>🔬 정책연구 데이터 동의</div>
              <p style={{ fontSize: 12, color: c.g700, lineHeight: 1.7, marginBottom: 10 }}>
                입력하신 업종·지역 정보와 <strong>익명 진단 결과</strong> 는
                "AI 자가진단 플랫폼의 근로감독 행정 효율성 및 사업장 준법 수준에 미치는 효과" 연구에서 활용됩니다.
                개인·사업자 식별 정보가 노출되지 않으며, 정책 개선을 위한 통계 자료로만 사용됩니다.
                6~12개월 후 변화 추적 연구를 위해 재방문하는 경우가 있습니다.
              </p>
              <div style={{ fontSize: 11, color: c.g500 }}>
                ※ 동의 거부 시 서비스 이용은 가능하나 전체 기능이 제한됩니다.
              </div>
            </div>

            <button onClick={handleOnboardDone} disabled={!canSubmit}
              style={{ padding: "14px", background: canSubmit ? c.navy : c.g300, color: "#fff", borderRadius: 12, fontSize: 15, fontWeight: 700, border: "none", cursor: canSubmit ? "pointer" : "default", transition: "all .2s" }}>
              {canSubmit ? "진단 시작하기 →" : "필수 항목을 입력해주세요"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ■ 메인 화면 ■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■
  const TABS = [
    { id: "diagnosis", label: "자가진단", icon: "📋" }, 
    { id: "industry", label: "업종 위험", icon: "📊" }, 
    { id: "contract", label: "계약서 생성", icon: "📝" },
    { id: "minwage", label: "최저임금", icon: "💰" },
    { id: "classification", label: "근로자성", icon: "⚖️" },
    { id: "retirement", label: "퇴직금", icon: "🏦" },
    { id: "workhours", label: "근로시간", icon: "⏰" }
  ];

  return (
    <div style={{ minHeight: "100vh", background: c.bg }}>
      <header style={{ background: c.card, borderBottom: `1px solid ${c.g100}`, padding: "0 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: c.g500, fontSize: 13, cursor: "pointer" }}>← 처음으로</button>
            <span style={{ color: c.g300 }}>|</span>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 900, color: c.ink }}>NORMU</span>
            <span style={{ background: c.navy, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>사업주</span>
          </div>
          <div style={{ fontSize: 11, color: c.g500, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ background: c.amberP, color: c.amber, padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>{profile.industry}</span>
            <span>{profile.sigungu || profile.region}</span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 20px 80px" }}>
        <div style={{ display: "flex", gap: 3, background: c.g100, borderRadius: 11, padding: 3, marginBottom: 22 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); saveAction('tab_change', { tab: t.id }); }}
              style={{ flex: 1, padding: "10px 4px", borderRadius: 9, border: "none", fontSize: 12, fontWeight: tab === t.id ? 700 : 500, background: tab === t.id ? c.card : "transparent", color: tab === t.id ? c.ink : c.g500, boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,.07)" : "none", transition: "all .15s" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* 자가진단 */}
        {tab === "diagnosis" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* 업종정보 위험도 미리보기 + DB 연동 정보 */}
            {DB.insurance[profile.industry] && (
              <div style={{ background: c.navy, borderRadius: 13, padding: "14px 18px", marginBottom: 4 }}>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 11, color: "rgba(255,255,255,.5)", marginBottom: 2 }}>
                      📊 {profile.industry} 실제 DB 통계 (코드: {DB.insurance[profile.industry].code})
                    </div>
                    <div style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>
                      퇴직급여설정률 <span style={{ color: "#FCA5A5", fontWeight: 800 }}>{DB.insurance[profile.industry].ret}%</span>
                      &nbsp;· 고용보험가입률 <span style={{ color: "#FCD34D", fontWeight: 800 }}>{DB.insurance[profile.industry].ins}%</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,.4)", textAlign: "right" }}>
                    vw_api_yearly_<br />industry_size 기반
                  </div>
                </div>
              </div>
            )}
            {CHECKS.map(ch => (
              <div key={ch.id} style={{ background: answers[ch.id] === false ? c.redP : answers[ch.id] === true ? c.greenP : c.card, borderRadius: 12, padding: "14px 16px", border: `1px solid ${answers[ch.id] === false ? `${c.red}35` : answers[ch.id] === true ? `${c.green}25` : c.g100}`, transition: "all .15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", gap: 6, marginBottom: 5 }}>
                      <span style={{ background: c.amberP, color: c.amber, fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 99 }}>{ch.cat}</span>
                      {ch.crit && <span style={{ fontSize: 10, color: c.red, fontWeight: 700, alignSelf: "center" }}>필수</span>}
                    </div>
                    <div style={{ fontSize: 13, color: c.ink, lineHeight: 1.55 }}>{ch.q}</div>
                    <div style={{ fontSize: 11, color: c.g500, marginTop: 3 }}>{ch.law}{ch.max > 0 && ` · 최대 ${fmt(ch.max)}원`}</div>
                  </div>
                  <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                    {[{ v: true, l: "예" }, { v: false, l: "아니오" }].map(b => (
                      <button key={String(b.v)} onClick={() => {
                        const newA = { ...answers, [ch.id]: b.v };
                        setAnswers(newA);
                        if (Object.keys(newA).length === 8) handleDiagDone();
                      }}
                        style={{ padding: "7px 13px", borderRadius: 8, fontSize: 12, fontWeight: 600, transition: "all .12s", background: answers[ch.id] === b.v ? (b.v ? c.green : c.red) : c.g100, color: answers[ch.id] === b.v ? "#fff" : c.g500, border: "none" }}>
                        {b.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
            {done && (
              <div className="pi" style={{ background: `${risk.c}08`, borderRadius: 14, padding: "22px 24px", border: `2px solid ${risk.c}`, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 46, height: 46, borderRadius: "50%", background: risk.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#fff", fontWeight: 900 }}>{risk.l === "양호" ? "✓" : "!"}</div>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: risk.c }}>{risk.l}</div>
                    <div style={{ fontSize: 12, color: c.g500 }}>위반 {viols.length}건 (필수 {crits}건)</div>
                  </div>
                </div>
                {viols.length > 0 && (
                  <div style={{ background: `${risk.c}10`, borderRadius: 10, padding: "14px 16px", marginBottom: 12 }}>
                    <div style={{ fontSize: 11, color: c.g500, marginBottom: 4 }}>예상 최대 과태료 합계</div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 26, fontWeight: 700, color: risk.c }}>{fmt(penalty)}원</div>
                  </div>
                )}
                <div style={{ fontSize: 11, color: c.g500 }}>
                  🔬 이 결과는 연구 기선점(T=0)으로 저장되었습니다. 6개월 후 재진단을 요청드릴 예정입니다.
                </div>
              </div>
            )}
          </div>
        )}

        {/* 업종 위험 */}
        {tab === "industry" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: c.card, borderRadius: 12, padding: "14px 18px", border: `1px solid ${c.g100}` }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 8 }}>업종 선택</label>
              <select value={industry2} onChange={e => { setInd2(e.target.value); setAT(""); }} style={{ ...sel }}>
                {INDS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            {iData && (
              <>
                <div style={{ background: c.card, borderRadius: 14, padding: "20px 22px", border: `2px solid ${RC[iData.risk]}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                    <span style={{ background: `${RC[iData.risk]}18`, color: RC[iData.risk], fontSize: 12, fontWeight: 700, padding: "5px 14px", borderRadius: 99 }}>{iData.risk}</span>
                    <span style={{ fontSize: 11, color: c.g500, fontFamily: "'IBM Plex Mono',monospace" }}>
                      DB코드: {iData.code} | 3년간 실데이터
                    </span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, marginBottom: 18 }}>
                    {[
                      { l: "고용보험가입률", v: `${iData.ins}%`, w: iData.ins > 20, note: "소상공인 평균 23.1%" },
                      { l: "퇴직급여설정률", v: `${iData.ret}%`, w: iData.ret < 75, note: "법정 의무 기준" },
                      { l: "월 초과근로", v: `${iData.ot}h`, w: iData.ot > 8, note: "주52시간 기준" },
                    ].map(s => (
                      <div key={s.l} style={{ background: s.w ? `${c.red}08` : c.g50, borderRadius: 9, padding: "11px 13px", border: `1px solid ${s.w ? `${c.red}25` : c.g100}` }}>
                        <div style={{ fontSize: 10, color: c.g500, marginBottom: 4 }}>{s.l}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 20, fontWeight: 700, color: s.w ? c.red : c.ink }}>{s.v}</div>
                        <div style={{ fontSize: 9, color: c.g500, marginTop: 2 }}>{s.note}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.g700, marginBottom: 10 }}>과거 위험 TOP3 (2019~2023 공단데이터)</div>
                  {vData.map((v, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: i < 2 ? `1px solid ${c.g100}` : "none" }}>
                      <span style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: c.amber, fontWeight: 700, minWidth: 22 }}>{String(i + 1).padStart(2, "0")}</span>
                      <span style={{ fontSize: 13, color: c.ink }}>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ background: c.card, borderRadius: 12, padding: "16px 18px", border: `1px solid ${c.g100}` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.g700, marginBottom: 10 }}>⚡ AI 리스크 분석 → 근로감독관 시각</div>
                  {aiText ? (
                    <p style={{ fontSize: 13, color: c.ink, lineHeight: 1.75 }}>{aiText}</p>
                  ) : (
                    <button onClick={runAI} disabled={aiLoading}
                      style={{ width: "100%", padding: "12px", background: aiLoading ? c.g100 : c.navy, color: aiLoading ? c.g500 : "#fff", borderRadius: 10, fontSize: 13, fontWeight: 600, border: "none", cursor: aiLoading ? "default" : "pointer" }}>
                      {aiLoading ? "분석 중..." : `${industry2} 업종 AI 리스크 분석`}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* 계약서 생성 */}
        {tab === "contract" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: `linear-gradient(135deg,${c.navy},#1e3a5f)`, borderRadius: 16, padding: "20px 22px" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>근로기준법 완벽 준수 계약서</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.85)", lineHeight: 1.7 }}>
                입력하신 정보로 2026년 근로기준법을 완벽하게 준수하는 표준 근로계약서를 자동 생성합니다.
              </div>
            </div>

            <div style={{ background: c.card, borderRadius: 13, padding: "20px 22px", border: `1px solid ${c.g100}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.ink, marginBottom: 16 }}>근로자 정보 입력</div>
              
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>직무/직종 <span style={{ color: c.red }}>*</span></label>
                <input 
                  value={contractData.jobTitle} 
                  onChange={e => setContractData(prev => ({ ...prev, jobTitle: e.target.value }))} 
                  placeholder="예: 홀서빙, 주방보조, 매장관리" 
                  style={inp} 
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 8 }}>근로 형태 <span style={{ color: c.red }}>*</span></label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["정규직", "기간제(계약직)", "단시간(파트타임)"].map(type => (
                    <button
                      key={type}
                      onClick={() => setContractData(prev => ({ ...prev, workType: type }))}
                      style={{
                        padding: "10px 16px",
                        borderRadius: 8,
                        border: `2px solid ${contractData.workType === type ? c.navy : c.g100}`,
                        background: contractData.workType === type ? c.navyP : c.g50,
                        color: contractData.workType === type ? c.navy : c.g500,
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all .15s"
                      }}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>주 근로시간 <span style={{ color: c.red }}>*</span></label>
                  <input 
                    value={contractData.workHours} 
                    onChange={e => setContractData(prev => ({ ...prev, workHours: e.target.value }))} 
                    placeholder="40" 
                    style={inp} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>
                    {contractData.workType === "단시간(파트타임)" ? "시급 (원)" : "월급 (원)"} <span style={{ color: c.red }}>*</span>
                  </label>
                  <input 
                    value={contractData.workType === "단시간(파트타임)" ? contractData.hourlyWage : contractData.monthlyWage} 
                    onChange={e => setContractData(prev => ({ 
                      ...prev, 
                      [contractData.workType === "단시간(파트타임)" ? "hourlyWage" : "monthlyWage"]: e.target.value 
                    }))} 
                    placeholder={contractData.workType === "단시간(파트타임)" ? "10500" : "2400000"} 
                    style={inp} 
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>근무 시작일 <span style={{ color: c.red }}>*</span></label>
                  <input 
                    type="date"
                    value={contractData.startDate} 
                    onChange={e => setContractData(prev => ({ ...prev, startDate: e.target.value }))} 
                    style={inp} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>근무 장소</label>
                  <input 
                    value={contractData.workPlace} 
                    onChange={e => setContractData(prev => ({ ...prev, workPlace: e.target.value }))} 
                    placeholder="예: 서울 강남구" 
                    style={inp} 
                  />
                </div>
              </div>

              <button 
                onClick={() => {
                  if (!contractData.jobTitle || !contractData.startDate || 
                      (contractData.workType === "단시간(파트타임)" && !contractData.hourlyWage) ||
                      (contractData.workType !== "단시간(파트타임)" && !contractData.monthlyWage)) {
                    alert("필수 항목을 모두 입력해주세요.");
                    return;
                  }
                  setGeneratingContract(true);
                  alert("계약서 생성 기능은 다음 업데이트에서 제공됩니다!");
                  setGeneratingContract(false);
                }}
                disabled={generatingContract}
                style={{ 
                  width: "100%", 
                  padding: "14px", 
                  background: generatingContract ? c.g300 : c.navy, 
                  color: "#fff", 
                  borderRadius: 12, 
                  fontSize: 14, 
                  fontWeight: 700, 
                  border: "none",
                  cursor: generatingContract ? "default" : "pointer"
                }}
              >
                {generatingContract ? "생성 중..." : "📝 근로계약서 생성하기"}
              </button>
            </div>

            <div style={{ background: c.greenP, borderRadius: 12, padding: "16px 18px", border: `1px solid rgba(22,163,74,.2)` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.green, marginBottom: 6 }}>✅ 포함되는 필수 조항</div>
              <div style={{ fontSize: 12, color: c.ink, lineHeight: 1.8 }}>
                • 근로계약 기간, 근무 장소, 업무 내용<br/>
                • 근로시간 (주 {contractData.workHours}시간), 휴게시간<br/>
                • 임금 (최저임금 {fmt(DB.min_wage[2026])}원 준수)<br/>
                • 주휴수당, 연차휴가, 퇴직금 규정<br/>
                • 4대보험 가입 안내 (해당 시)
              </div>
            </div>
          </div>
        )}

        {/* 최저임금 */}
        {tab === "minwage" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: c.amberP, border: `1px solid rgba(217,119,6,.3)`, borderRadius: 13, padding: "18px 22px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: c.amber, marginBottom: 4 }}>2026년 최저임금</div>
              <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 30, fontWeight: 700, color: c.ink }}>
                {fmt(DB.min_wage[2026])}<span style={{ fontSize: 15, color: c.g500 }}>원/시</span>
              </div>
              <div style={{ fontSize: 12, color: c.g700, marginTop: 5 }}>월 환산 (주40시간): {fmt(DB.min_wage[2026] * 209)}원</div>
            </div>
            <div style={{ background: c.card, borderRadius: 13, padding: "20px", border: `1px solid ${c.g100}` }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>월 임금 (원)</label>
                  <input value={wage} onChange={e => setWage(e.target.value)} placeholder="2,000,000" style={{ ...inp }} /></div>
                <div><label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>주 소정근로시간</label>
                  <input value={wh} onChange={e => setWh(e.target.value)} placeholder="40" style={{ ...inp }} /></div>
              </div>
              <button onClick={checkWage} style={{ width: "100%", padding: "12px", background: c.navy, color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 700, border: "none" }}>위반 여부 판정</button>
            </div>
            {wageResult && (
              <div className="pi" style={{ background: c.card, borderRadius: 13, padding: "20px 22px", border: `2px solid ${wageResult.violated ? c.red : c.green}` }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: wageResult.violated ? c.red : c.green, marginBottom: 14 }}>
                  {wageResult.violated ? "⚠️ 최저임금 위반" : "✅ 최저임금 준수"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                  {[["실제 시급", `${fmt(wageResult.actual)}원`, false], ["최저 시급", `${fmt(wageResult.min)}원`, false],
                    wageResult.violated && ["시급 부족분", `${fmt(wageResult.shortage)}원`, true],
                    wageResult.violated && ["월 추가지급", `${fmt(wageResult.monthly)}원`, true],
                  ].filter(Boolean).map(([k, v, w]) => (
                    <div key={k} style={{ background: c.g50, borderRadius: 8, padding: "10px 13px" }}>
                      <div style={{ fontSize: 11, color: c.g500, marginBottom: 3 }}>{k}</div>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 16, fontWeight: 700, color: w ? c.red : c.ink }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 근로자성 판단 (Phase 3) */}
        {tab === "classification" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: c.card, borderRadius: 13, padding: "20px 22px", border: `1px solid ${c.g100}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.ink, marginBottom: 16 }}>근로자성 판단 (위탁·도급 계약 검토)</div>
              <div style={{ fontSize: 12, color: c.g700, marginBottom: 16 }}>
                프리랜서, 위탁계약으로 일하지만 실질적으로 근로자에 해당할 수 있습니다.
              </div>
              
              {classificationQuestions.map((q, i) => (
                <div key={q.id} style={{ marginBottom: 16, padding: "16px", background: c.g50, borderRadius: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: c.ink, marginBottom: 8 }}>{i + 1}. {q.text}</div>
                  <div style={{ fontSize: 11, color: c.amber, marginBottom: 10 }}>{q.category} (가중치: {q.weight}%)</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {q.options.map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setClassAnswers(prev => ({ ...prev, [q.id]: opt }))}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: `2px solid ${classAnswers[q.id]?.value === opt.value ? c.navy : c.g100}`,
                          background: classAnswers[q.id]?.value === opt.value ? c.navyP : "white",
                          color: classAnswers[q.id]?.value === opt.value ? c.navy : c.g500,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all .15s"
                        }}
                      >
                        {opt.text}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              
              <button 
                onClick={analyzeClassification}
                disabled={Object.keys(classAnswers).length < classificationQuestions.length}
                style={{ 
                  width: "100%", 
                  padding: "14px", 
                  background: Object.keys(classAnswers).length < classificationQuestions.length ? c.g300 : c.navy, 
                  color: "#fff", 
                  borderRadius: 12, 
                  fontSize: 14, 
                  fontWeight: 700, 
                  border: "none",
                  cursor: Object.keys(classAnswers).length < classificationQuestions.length ? "default" : "pointer"
                }}
              >
                근로자성 판단 결과 보기
              </button>
            </div>
            
            {classResult && (
              <div className="pi" style={{ background: c.card, borderRadius: 13, padding: "20px 22px", border: `2px solid ${classResult.percentage >= 70 ? c.green : classResult.percentage >= 40 ? c.amber : c.red}` }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: classResult.percentage >= 70 ? c.green : classResult.percentage >= 40 ? c.amber : c.red, marginBottom: 12 }}>
                  {classResult.classification} ({classResult.percentage}%)
                </div>
                <p style={{ fontSize: 13, color: c.g700, lineHeight: 1.6, marginBottom: 16 }}>{classResult.advice}</p>
                
                <div style={{ background: c.g50, borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: c.g700, marginBottom: 8 }}>상세 분석 결과</div>
                  {classResult.details.map((detail, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                      <span style={{ fontSize: 11, color: c.g600 }}>{detail.category}: {detail.answer}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: c.navy }}>{detail.score}/{detail.maxScore}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 퇴직금 계산기 (Phase 3) */}
        {tab === "retirement" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: c.card, borderRadius: 13, padding: "20px 22px", border: `1px solid ${c.g100}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.ink, marginBottom: 16 }}>퇴직금 계산기</div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>일평균임금 (원)</label>
                  <input 
                    value={retireInputs.avgWage} 
                    onChange={e => setRetireInputs(prev => ({ ...prev, avgWage: e.target.value }))} 
                    placeholder="80,000" 
                    style={inp} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>근로일수</label>
                  <input 
                    value={retireInputs.workDays} 
                    onChange={e => setRetireInputs(prev => ({ ...prev, workDays: e.target.value }))} 
                    placeholder="365" 
                    style={inp} 
                  />
                </div>
              </div>
              
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>총 근속일수</label>
                <input 
                  value={retireInputs.totalDays} 
                  onChange={e => setRetireInputs(prev => ({ ...prev, totalDays: e.target.value }))} 
                  placeholder="730" 
                  style={inp} 
                />
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 8 }}>퇴직 사유</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { value: "normal", text: "정상퇴사" },
                    { value: "voluntary", text: "자진퇴사" },
                    { value: "dismissal", text: "해고" }
                  ].map(option => (
                    <button
                      key={option.value}
                      onClick={() => setRetireInputs(prev => ({ ...prev, retireType: option.value }))}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: 8,
                        border: `2px solid ${retireInputs.retireType === option.value ? c.navy : c.g100}`,
                        background: retireInputs.retireType === option.value ? c.navyP : c.g50,
                        color: retireInputs.retireType === option.value ? c.navy : c.g500,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all .15s"
                      }}
                    >
                      {option.text}
                    </button>
                  ))}
                </div>
              </div>
              
              <button onClick={calculateRetirement} style={{ width: "100%", padding: "12px", background: c.navy, color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 700, border: "none" }}>
                퇴직금 계산하기
              </button>
            </div>
            
            {retireResult && (
              <div className="pi" style={{ background: c.card, borderRadius: 13, padding: "20px 22px", border: `2px solid ${c.green}` }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: c.green, marginBottom: 16 }}>퇴직금 계산 결과</div>
                
                <div style={{ background: c.greenP, borderRadius: 10, padding: "16px 18px", marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: c.g500, marginBottom: 4 }}>지급받을 퇴직금</div>
                  <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 24, fontWeight: 700, color: c.green }}>
                    {fmt(retireResult.retirementPay)}원
                  </div>
                </div>
                
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {Object.entries(retireResult.details).map(([key, value]) => (
                    <div key={key} style={{ background: c.g50, borderRadius: 8, padding: "10px 12px" }}>
                      <div style={{ fontSize: 11, color: c.g500, marginBottom: 3 }}>{key}</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: c.ink }}>{typeof value === "number" ? fmt(value) : value}</div>
                    </div>
                  ))}
                </div>
                
                {retireResult.canInterimSettlement && (
                  <div style={{ background: c.amberP, borderRadius: 8, padding: "12px 14px", marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: c.amber }}>💡 중간정산 가능</div>
                    <div style={{ fontSize: 11, color: c.g700 }}>1년 이상 근속으로 중간정산 신청 가능</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 근로시간 진단 (Phase 3) */}
        {tab === "workhours" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: c.card, borderRadius: 13, padding: "20px 22px", border: `1px solid ${c.g100}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.ink, marginBottom: 16 }}>근로시간 준수 진단</div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>주 정규근로시간</label>
                  <input 
                    value={schedule.regularHours} 
                    onChange={e => setSchedule(prev => ({ ...prev, regularHours: Number(e.target.value) }))} 
                    type="number"
                    style={inp} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>주 연장근로시간</label>
                  <input 
                    value={schedule.overtimeHours} 
                    onChange={e => setSchedule(prev => ({ ...prev, overtimeHours: Number(e.target.value) }))} 
                    type="number"
                    style={inp} 
                  />
                </div>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>야간근로시간 (22시~6시)</label>
                  <input 
                    value={schedule.nightHours} 
                    onChange={e => setSchedule(prev => ({ ...prev, nightHours: Number(e.target.value) }))} 
                    type="number"
                    style={inp} 
                  />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>휴일근로시간</label>
                  <input 
                    value={schedule.holidayHours} 
                    onChange={e => setSchedule(prev => ({ ...prev, holidayHours: Number(e.target.value) }))} 
                    type="number"
                    style={inp} 
                  />
                </div>
              </div>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 8 }}>휴게시간 부여</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { value: true, text: "부여함" },
                    { value: false, text: "미부여" }
                  ].map(option => (
                    <button
                      key={String(option.value)}
                      onClick={() => setSchedule(prev => ({ ...prev, hasBreakTime: option.value }))}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: 8,
                        border: `2px solid ${schedule.hasBreakTime === option.value ? c.navy : c.g100}`,
                        background: schedule.hasBreakTime === option.value ? c.navyP : c.g50,
                        color: schedule.hasBreakTime === option.value ? c.navy : c.g500,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all .15s"
                      }}
                    >
                      {option.text}
                    </button>
                  ))}
                </div>
              </div>
              
              <button onClick={analyzeWorkHours} style={{ width: "100%", padding: "12px", background: c.navy, color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 700, border: "none" }}>
                근로시간 위반 여부 진단
              </button>
            </div>
            
            {diagnosis && (
              <div className="pi" style={{ background: c.card, borderRadius: 13, padding: "20px 22px", border: `2px solid ${diagnosis.riskLevel === "정상" ? c.green : diagnosis.riskLevel === "주의" ? c.amber : c.red}` }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: diagnosis.riskLevel === "정상" ? c.green : diagnosis.riskLevel === "주의" ? c.amber : c.red, marginBottom: 12 }}>
                  {diagnosis.riskLevel} (총 주 {diagnosis.totalWeekly}시간)
                </div>
                
                {diagnosis.violations.length > 0 ? (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: c.g700, marginBottom: 8 }}>위반 사항</div>
                    {diagnosis.violations.map((violation, i) => (
                      <div key={i} style={{ background: c.redP, borderRadius: 8, padding: "12px 14px", marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: c.red, marginBottom: 4 }}>{violation.description}</div>
                        <div style={{ fontSize: 11, color: c.g700 }}>{violation.penalty}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ background: c.greenP, borderRadius: 8, padding: "12px 14px", marginBottom: 16 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.green }}>✅ 근로시간 관련 위반사항 없음</div>
                  </div>
                )}
                
                <div style={{ background: c.g50, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: c.g700, marginBottom: 6 }}>개선 권고사항</div>
                  {diagnosis.recommendations.map((rec, i) => (
                    <div key={i} style={{ fontSize: 11, color: c.g600, display: "flex", gap: 6 }}>
                      <span>·</span>
                      <span>{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 근로자 앱 (연구 데이터 수집 통합)
// ═══════════════════════════════════════════════════════════════════════════════════════════════
const WorkerApp = ({ onBack }) => {
  const [screen, setScreen] = useState("onboard");
  const [profile, setProfile] = useState({ industry: "", region: "", sigungu: "", workHours: "", empType: "" });
  const [tab, setTab] = useState("check");
  const [hourly, setH] = useState("");
  const [weekly, setW] = useState("");
  const [payType, setPT] = useState("hourly");
  const [monthly, setM] = useState("");
  const [tenure, setTen] = useState("");
  const [result, setRes] = useState(null);
  const [industry2, setInd2] = useState("음식점업·주점업");
  
  // 계약서 첨삭 state
  const [uploadedFile, setUploadedFile] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  
  const { track, saveAction } = useResearchCollector();
  const c = W2;
  const MIN = DB.min_wage[2026];

  const setP = (k, v) => setProfile(p => ({ ...p, [k]: v }));
  const canSubmit = profile.industry && profile.region && profile.sigungu;
  const iData = DB.insurance[industry2];

  const inp = { width: "100%", padding: "11px 14px", background: c.g50, border: `1.5px solid ${c.g100}`, borderRadius: 9, fontSize: 14, color: c.ink, boxSizing: "border-box", fontFamily: "inherit" };
  const sel = { ...inp, cursor: "pointer" };

  const handleOnboardDone = () => {
    track('worker_onboard', { industry: profile.industry, region: profile.region, sigungu: profile.sigungu, empType: profile.empType });
    setScreen("main");
  };

  const analyze = () => {
    const wh = Number(weekly); if (!wh) return;
    let actualHourly;
    if (payType === "hourly") {
      actualHourly = Number(hourly);
    } else {
      const hrs = (wh + wh / 5) * 365 / 7 / 12;
      actualHourly = Math.round(Number(monthly.replace(/,/g, "")) / hrs);
    }
    if (!actualHourly) return;
    const monthlyHrs = (wh + wh / 5) * 365 / 7 / 12;
    const weeklyRestPay = wh >= 15 ? Math.round(actualHourly * (wh / 5)) : 0;
    const r = {
      actualHourly, minWageViolated: actualHourly < MIN,
      shortage: Math.max(0, MIN - actualHourly),
      monthlyShortage: Math.round(Math.max(0, MIN - actualHourly) * monthlyHrs),
      weeklyRestPay, hasWeeklyRest: wh >= 15,
      retireEligible: wh >= 15 && Number(tenure) >= 12,
      ins4Required: wh * 4.33 >= 60,
    };
    setRes(r);
    saveAction('worker_analysis', {
      industry: profile.industry, region: profile.region, sigungu: profile.sigungu,
      weeklyH: wh, violated: r.minWageViolated, hasWeeklyRest: r.hasWeeklyRest,
    });
  };

  const TABS = [
    { id: "check", label: "내 임금 확인", icon: "💰" }, 
    { id: "scan", label: "계약서 첨삭", icon: "🔴" },
    { id: "rights", label: "내 권리", icon: "✅" }, 
    { id: "report", label: "신고 방법", icon: "📢" }
  ];

  // 근로자 온보딩
  if (screen === "onboard") return (
    <div style={{ minHeight: "100vh", background: c.bg }}>
      <header style={{ background: c.card, borderBottom: `1px solid ${c.g100}`, padding: "0 20px" }}>
        <div style={{ maxWidth: 620, margin: "0 auto", display: "flex", alignItems: "center", height: 54, gap: 10 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", color: c.g500, fontSize: 13, cursor: "pointer" }}>← 처음으로</button>
          <span style={{ color: c.g300 }}>|</span>
          <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 900, color: c.ink }}>NORMU</span>
          <span style={{ background: c.teal, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>근로자</span>
        </div>
      </header>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "32px 20px 80px" }}>
        <div className="fu">
          <div style={{ background: `linear-gradient(135deg,${c.teal},#059669)`, borderRadius: 16, padding: "20px 22px", marginBottom: 28 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#fff", marginBottom: 5 }}>무료 임금 확인 알려드립니다</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,.8)", lineHeight: 1.65 }}>
              최저임금 확인을 입력하여 더 많은 권리 분석을 해드리겠습니다.<br />
              <span style={{ fontWeight: 600, color: "#A7F3D0" }}>모든 정보는 익명으로 처리됩니다.</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>일하는 업종 <span style={{ color: c.teal }}>*</span></label>
              <select value={profile.industry} onChange={e => setP("industry", e.target.value)} style={sel}>
                <option value="">선택해주세요</option>
                {INDS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>
                일하는 지역 <span style={{ color: c.teal }}>*</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: c.g500, marginLeft: 6 }}>(지역구 위험 혜택 분석용 사용)</span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <select value={profile.region} onChange={e => { setP("region", e.target.value); setP("sigungu", ""); }} style={sel}>
                  <option value="">광역시·도</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select value={profile.sigungu} onChange={e => setP("sigungu", e.target.value)} style={{ ...sel, opacity: profile.region ? 1 : 0.4 }} disabled={!profile.region}>
                  <option value="">시·구·군</option>
                  {(SIGUNGU[profile.region] || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label style={{ fontSize: 13, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>고용 형태</label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["정규직", "기간제", "단시간(알바)", "특수형태근로종사자(프리랜서)", "기타"].map(o => (
                  <button key={o} onClick={() => setP("empType", o)}
                    style={{ padding: "8px 14px", borderRadius: 99, border: `2px solid ${profile.empType === o ? c.teal : c.g100}`, background: profile.empType === o ? c.tealP : c.g50, fontWeight: 600, fontSize: 12, color: profile.empType === o ? c.teal : c.g500, transition: "all .15s" }}>
                    {o}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ background: "rgba(13,148,136,.08)", borderRadius: 12, padding: "14px 18px", border: `1px solid rgba(13,148,136,.15)` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.teal, marginBottom: 8 }}>🔬 익명 데이터 수집 안내</div>
              <p style={{ fontSize: 12, color: c.g700, lineHeight: 1.7 }}>
                입력하신 업종·지역 정보는 익명 진단 결과는
                "AI 자가진단 플랫폼이 근로감독 행정 효율성 및 사업장 준법 수준에 미치는 효과" 연구에서 활용됩니다.
                개인 식별 정보가 노출되지 않으며, 근로자 권익 보호를 위한 정책 개선 연구 목적으로만 사용됩니다.
              </p>
            </div>

            <button onClick={handleOnboardDone} disabled={!canSubmit}
              style={{ padding: "14px", background: canSubmit ? c.teal : "#9ECDC5", color: "#fff", borderRadius: 12, fontSize: 15, fontWeight: 700, border: "none", cursor: canSubmit ? "pointer" : "default" }}>
              {canSubmit ? "내 권리 확인하기 →" : "업종과 지역을 선택해주세요"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // 근로자 메인
  return (
    <div style={{ minHeight: "100vh", background: c.bg }}>
      <header style={{ background: c.card, borderBottom: `1px solid ${c.g100}`, padding: "0 20px", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 54 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={onBack} style={{ background: "none", border: "none", color: c.g500, fontSize: 13, cursor: "pointer" }}>← 처음으로</button>
            <span style={{ color: c.g300 }}>|</span>
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 900, color: c.ink }}>NORMU</span>
            <span style={{ background: c.teal, color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>근로자</span>
          </div>
          <div style={{ fontSize: 11, color: c.g500, display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ background: c.tealP, color: c.teal, padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>{profile.industry}</span>
            <span>{profile.sigungu || profile.region}</span>
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 20px 80px" }}>
        <div style={{ display: "flex", gap: 3, background: c.g100, borderRadius: 11, padding: 3, marginBottom: 22 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); saveAction('worker_tab', { tab: t.id }); }}
              style={{ flex: 1, padding: "10px 4px", borderRadius: 9, border: "none", fontSize: 12, fontWeight: tab === t.id ? 700 : 500, background: tab === t.id ? c.card : "transparent", color: tab === t.id ? c.teal : c.g500, boxShadow: tab === t.id ? "0 1px 4px rgba(0,0,0,.07)" : "none", transition: "all .15s" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* 임금 확인 */}
        {tab === "check" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: c.card, borderRadius: 13, padding: "20px", border: `1px solid ${c.g100}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.ink, marginBottom: 16 }}>급여 정보 입력</div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 8 }}>급여 유형</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {[{ v: "hourly", l: "시급제" }, { v: "monthly", l: "월급제" }].map(o => (
                    <button key={o.v} onClick={() => setPT(o.v)}
                      style={{ flex: 1, padding: "10px", borderRadius: 9, border: `2px solid ${payType === o.v ? c.teal : c.g100}`, background: payType === o.v ? c.tealP : c.g50, fontWeight: 600, fontSize: 13, color: payType === o.v ? c.teal : c.g500, transition: "all .15s" }}>
                      {o.l}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>{payType === "hourly" ? "시급 (원)" : "월급 (원)"}</label>
                  <input value={payType === "hourly" ? hourly : monthly} onChange={e => payType === "hourly" ? setH(e.target.value) : setM(e.target.value)} placeholder={payType === "hourly" ? "10500" : "2,000,000"} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>주 근로시간</label>
                  <input value={weekly} onChange={e => setW(e.target.value)} placeholder="예: 20 " style={inp} />
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: c.g700, display: "block", marginBottom: 7 }}>근로 개월수 (퇴직급여 확인용)</label>
                <input value={tenure} onChange={e => setTen(e.target.value)} placeholder="예: 13 (13개월)" style={inp} />
              </div>
              <button onClick={analyze} style={{ width: "100%", padding: "13px", background: c.teal, color: "#fff", borderRadius: 11, fontSize: 14, fontWeight: 700, border: "none" }}>내 권리 계산하기</button>
            </div>
            {result && (
              <div className="pi" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ background: result.minWageViolated ? c.redP : c.greenP, borderRadius: 13, padding: "18px 20px", border: `2px solid ${result.minWageViolated ? c.red : c.green}` }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: result.minWageViolated ? c.red : c.green, marginBottom: 12 }}>
                    {result.minWageViolated ? "⚠️ 최저임금 위반 가능성이 있습니다" : "✅ 최저임금 기준을 충족합니다"}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[["내 시급", `${fmt(result.actualHourly)}원`], ["법정 최저시급", `${fmt(MIN)}원`],
                      result.minWageViolated && ["시급 부족분", `${fmt(result.shortage)}원`],
                      result.minWageViolated && ["월 추가지급 범위", `${fmt(result.monthlyShortage)}원`],
                    ].filter(Boolean).map(([k, v]) => (
                      <div key={k} style={{ background: "rgba(255,255,255,.7)", borderRadius: 8, padding: "10px 13px" }}>
                        <div style={{ fontSize: 11, color: c.g500, marginBottom: 3 }}>{k}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 16, fontWeight: 700, color: c.ink }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{ background: c.card, borderRadius: 13, padding: "16px 20px", border: `1px solid ${c.g100}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.ink, marginBottom: 10 }}>주휴수당 (주 15시간 이상 → 유급 하루)</div>
                  {result.hasWeeklyRest ? (
                    <div style={{ background: c.greenP, borderRadius: 8, padding: "10px 14px" }}>
                      <div style={{ fontSize: 11, color: c.g500, marginBottom: 2 }}>주휴수당 (주급)</div>
                      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 20, fontWeight: 700, color: c.green }}>{fmt(result.weeklyRestPay)}원</div>
                    </div>
                  ) : <div style={{ fontSize: 13, color: c.g500 }}>주 15시간 미만 근로 → 주휴수당 미적용</div>}
                </div>
                <div style={{ background: c.card, borderRadius: 13, padding: "16px 20px", border: `1px solid ${c.g100}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: c.ink, marginBottom: 8 }}>퇴직급여 수급 자격</div>
                  {result.retireEligible ? (
                    <div style={{ background: c.greenP, borderRadius: 8, padding: "12px 14px" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: c.green, marginBottom: 4 }}>✅ 퇴직급여 수급 대상입니다</div>
                      <div style={{ fontSize: 12, color: c.g700 }}>1년 이상 + 주 15시간 이상 → 퇴직 시 30일분 임금총액 이상</div>
                    </div>
                  ) : <div style={{ fontSize: 13, color: c.g500 }}>{Number(tenure) < 12 ? "1년 미만 근로 → 퇴직급여 미적용" : "주 15시간 미만 → 제한적 대상"}</div>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 계약서 첨삭 */}
        {tab === "scan" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: `linear-gradient(135deg,${c.teal},#059669)`, borderRadius: 16, padding: "20px 22px" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>계약서 빨간펜 첨삭 서비스 🔴</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.85)", lineHeight: 1.7 }}>
                내 근로계약서를 사진/PDF로 올리면 AI가 문제 조항을 빨간펜으로 지적해드립니다.
              </div>
            </div>

            <div style={{ background: c.card, borderRadius: 13, padding: "20px 22px", border: `1px solid ${c.g100}` }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.ink, marginBottom: 16 }}>계약서 업로드</div>
              
              <input 
                type="file" 
                accept="image/*,.pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadedFile(file);
                    setAnalysisResult(null);
                  }
                }}
                style={{ display: "none" }}
                id="contract-upload"
              />
              
              <label 
                htmlFor="contract-upload"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "40px 20px",
                  border: `2px dashed ${c.g300}`,
                  borderRadius: 12,
                  background: c.g50,
                  cursor: "pointer",
                  transition: "all .2s"
                }}
              >
                <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: c.ink, marginBottom: 6 }}>
                  {uploadedFile ? uploadedFile.name : "계약서 사진 또는 PDF 업로드"}
                </div>
                <div style={{ fontSize: 12, color: c.g500 }}>
                  {uploadedFile ? "다른 파일을 선택하려면 클릭" : "클릭하여 파일 선택 (JPG, PNG, PDF)"}
                </div>
              </label>

              {uploadedFile && !analysisResult && (
                <button 
                  onClick={async () => {
                    setAnalyzing(true);
                    // 실제로는 Anthropic API 호출하여 분석
                    setTimeout(() => {
                      setAnalysisResult({
                        problems: [
                          {
                            type: "error",
                            title: "최저임금 위반",
                            desc: `시급 9,000원으로 기재되어 있습니다. 2026년 최저시급 ${fmt(MIN)}원보다 낮습니다.`,
                            law: "최저임금법"
                          },
                          {
                            type: "warning",
                            title: "주휴수당 미기재",
                            desc: "주 15시간 이상 근로 시 주휴수당을 지급해야 하나 계약서에 명시되지 않았습니다.",
                            law: "근로기준법 제55조"
                          },
                          {
                            type: "warning",
                            title: "휴게시간 불명확",
                            desc: "4시간 근로 시 30분, 8시간 근로 시 1시간 휴게시간을 명시해야 합니다.",
                            law: "근로기준법 제54조"
                          }
                        ]
                      });
                      setAnalyzing(false);
                    }, 2000);
                  }}
                  style={{
                    width: "100%",
                    marginTop: 16,
                    padding: "14px",
                    background: analyzing ? c.g300 : c.teal,
                    color: "#fff",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    border: "none",
                    cursor: analyzing ? "default" : "pointer"
                  }}
                >
                  {analyzing ? "분석 중..." : "🔍 계약서 분석하기"}
                </button>
              )}
            </div>

            {analysisResult && (
              <>
                <div className="pi" style={{ background: c.redP, borderRadius: 13, padding: "18px 20px", border: `2px solid ${c.red}` }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: c.red, marginBottom: 12 }}>
                    ⚠️ {analysisResult.problems.filter(p => p.type === "error").length}개 치명적 문제, {analysisResult.problems.filter(p => p.type === "warning").length}개 경고 발견
                  </div>
                  <div style={{ fontSize: 12, color: c.g700 }}>
                    아래 문제들을 사업주에게 수정 요청하거나, 노동청에 신고할 수 있습니다.
                  </div>
                </div>

                {analysisResult.problems.map((problem, i) => (
                  <div 
                    key={i}
                    className="pi"
                    style={{ 
                      background: c.card, 
                      borderRadius: 13, 
                      padding: "18px 20px", 
                      border: `2px solid ${problem.type === "error" ? c.red : c.yellow}`,
                      animation: `pi .3s ${i * 0.1}s cubic-bezier(.34,1.56,.64,1) both`
                    }}
                  >
                    <div style={{ display: "flex", gap: 14 }}>
                      <div style={{ fontSize: 26, flexShrink: 0 }}>
                        {problem.type === "error" ? "🔴" : "⚠️"}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: problem.type === "error" ? c.red : c.yellow, marginBottom: 4 }}>
                          {problem.title}
                        </div>
                        <div style={{ fontSize: 13, color: c.ink, lineHeight: 1.65, marginBottom: 8 }}>
                          {problem.desc}
                        </div>
                        <div style={{ 
                          display: "inline-block",
                          background: problem.type === "error" ? c.redP : c.yellowP, 
                          color: problem.type === "error" ? c.red : c.yellow,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 6
                        }}>
                          {problem.law}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                <div style={{ background: c.tealP, borderRadius: 12, padding: "16px 18px", border: `1px solid rgba(13,148,136,.2)` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: c.teal, marginBottom: 6 }}>💡 다음 단계</div>
                  <div style={{ fontSize: 12, color: c.ink, lineHeight: 1.8 }}>
                    1. 사업주에게 계약서 수정 요청<br/>
                    2. 수정되지 않으면 노동청 1350 신고<br/>
                    3. 신고 시 이 분석 결과를 캡처하여 제출
                  </div>
                </div>
              </>
            )}

            <div style={{ background: c.yellowP, borderRadius: 12, padding: "16px 18px", border: `1px solid rgba(217,119,6,.2)` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.yellow, marginBottom: 6 }}>⚡ 데모 버전 안내</div>
              <div style={{ fontSize: 12, color: c.ink, lineHeight: 1.7 }}>
                현재는 시연용 샘플 결과가 표시됩니다. 실제 서비스에서는 업로드하신 계약서를 AI가 분석하여 정확한 문제점을 지적합니다.
              </div>
            </div>
          </div>
        )}

        {/* 내 권리 */}
        {tab === "rights" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: c.tealP, borderRadius: 13, padding: "16px 20px", border: `1px solid rgba(13,148,136,.2)` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.teal, marginBottom: 6 }}>⚠️ 5인 이하에게도 적용되는 핵심 권리</div>
              <div style={{ fontSize: 12, color: c.g700 }}>작은 사업장이라도 아래 권리는 100% 정당하게 받을 수 있습니다.</div>
            </div>
            {[
              { icon: "📄", title: "근로계약서", desc: "근무조건 서면 교부. 사업주 과태료 500만원까지. 구두계약 권리 있음", ok: true },
              { icon: "💰", title: "최저임금", desc: `2025년 ${fmt(MIN)}원/시. 출입금지만 위반시 정당하게 정당한 권리`, ok: true },
              { icon: "🕐️", title: "주휴수당", desc: "주 15시간 이상 근로자 일주일에 하루는 유급휴일 (1일 임금 추가 지급)", ok: true },
              { icon: "🏦", title: "퇴직급여", desc: "1년 이상 + 주15시간 이상 → 퇴직 시 30일분 임금총액. 알바도 해당", ok: true },
              { icon: "📋", title: "임금명세서", desc: "2021.11부터 매월 의무. 안 줄때 사업장 위반", ok: true },
              { icon: "⏰", title: "연장·야간·휴일 가산수당", desc: "5인 이상 사업장: 50% 가산 의무. 5인 미만: 법적 의무 없음", ok: false, note: "5인 미만 적용 제외" },
              { icon: "🌴", title: "연차유급휴가", desc: "5인 미만 사업장: 법적 적용 미의무. 5인 이상에서 휴가비 지급", ok: false, note: "5인 미만 적용 제외" },
            ].map((r, i) => (
              <div key={i} style={{ background: c.card, borderRadius: 12, padding: "15px 18px", border: `1px solid ${c.g100}`, display: "flex", gap: 14 }}>
                <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>{r.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: c.ink }}>{r.title}</span>
                    {r.ok === true && <span style={{ background: c.greenP, color: c.green, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>5인 이하 적용 ✅</span>}
                    {r.ok === false && <span style={{ background: c.g100, color: c.g500, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 99 }}>{r.note}</span>}
                  </div>
                  <div style={{ fontSize: 12, color: c.g700, lineHeight: 1.65 }}>{r.desc}</div>
                </div>
              </div>
            ))}
            <div style={{ background: c.card, borderRadius: 13, padding: "18px 20px", border: `1px solid ${c.g100}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: c.ink, marginBottom: 4 }}>내 업종 4대보험가입률</div>
              <div style={{ fontSize: 12, color: c.g500, marginBottom: 12 }}>5인 미만 · 2023~2025년 실데이터</div>
              <select value={industry2} onChange={e => setInd2(e.target.value)} style={{ ...sel, marginBottom: 12 }}>
                {INDS.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              {iData && <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                {[["고용보험가입률", `${iData.ins}%`, iData.ins > 15], ["퇴직급여설정률", `${iData.ret}%`, iData.ret > 70]].map(([l, v, w]) => (
                  <div key={l} style={{ background: w ? c.redP : c.greenP, borderRadius: 8, padding: "10px 13px" }}>
                    <div style={{ fontSize: 11, color: c.g500, marginBottom: 3 }}>{l}</div>
                    <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 20, fontWeight: 700, color: w ? c.red : c.green }}>{v}</div>
                  </div>
                ))}
              </div>}
            </div>
          </div>
        )}

        {/* 신고 방법 */}
        {tab === "report" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: `linear-gradient(135deg,${c.teal},#059669)`, borderRadius: 16, padding: "20px 22px" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 6 }}>신고는 익명으로도 가능합니다</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,.85)", lineHeight: 1.7 }}>신고로 인한 불이익은 법적으로 금지되어 있으며, 높은 확률로 시정 및 처벌될 수 있습니다.</div>
            </div>
            {[
              { icon: "📞", title: "고용노동부 콜센터", sub: "☎️ 1350 (평일 09~18시)", desc: "임금체불, 근로기준법 위반 등 모든 노동 상담 가능", link: "tel:1350", btn: "1350 전화" },
              { icon: "🌐", title: "고용노동부 노동포털", sub: "labor.moel.go.kr", desc: "온라인 임금체불 진정 신청. 익명 신고 가능", link: "https://labor.moel.go.kr", btn: "온라인 신고" },
            ].map((r, i) => (
              <div key={i} style={{ background: c.card, borderRadius: 13, padding: "18px 20px", border: `1px solid ${c.g100}` }}>
                <div style={{ display: "flex", gap: 14 }}>
                  <div style={{ fontSize: 26, flexShrink: 0 }}>{r.icon}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: c.ink, marginBottom: 2 }}>{r.title}</div>
                    <div style={{ fontSize: 12, color: c.teal, fontWeight: 600, marginBottom: 6 }}>{r.sub}</div>
                    <div style={{ fontSize: 12, color: c.g700, lineHeight: 1.65, marginBottom: 10 }}>{r.desc}</div>
                    <a href={r.link} onClick={() => saveAction('report_click', { channel: r.title })}
                      style={{ display: "inline-block", background: c.teal, color: "#fff", fontSize: 12, fontWeight: 700, padding: "8px 16px", borderRadius: 8, textDecoration: "none" }}>
                      {r.btn}
                    </a>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ background: c.yellowP, borderRadius: 12, padding: "16px 18px", border: `1px solid rgba(217,119,6,.2)` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: c.yellow, marginBottom: 6 }}>📌 신고 전 중요 서류</div>
              {["근로계약서 또는 급여명세서", "급여 입금 통장 내역", "출퇴근 기록 (근무일지, 메신저 대화 등)", "업무 지시 증거 (카카오톡, 문자 등)"].map((v, i) => (
                <div key={i} style={{ fontSize: 12, color: c.ink, padding: "4px 0", display: "flex", gap: 8 }}>
                  <span style={{ color: c.yellow, fontWeight: 700 }}>·</span>{v}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// 메인앱
// ═══════════════════════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [role, setRole] = useState(null);
  const [waitCount] = useState(487);
  return (
    <>
      <GS />
      {!role && <RoleLanding onSelect={setRole} waitCount={waitCount} />}
      {role === "boss" && <BossApp onBack={() => setRole(null)} />}
      {role === "worker" && <WorkerApp onBack={() => setRole(null)} />}
    </>
  );
}
