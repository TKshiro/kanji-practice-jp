import { useEffect, useRef, useState } from 'react';
import HanziWriter from 'hanzi-writer';
import confetti from 'canvas-confetti';
import { KANJI_GRADES, OVERRIDE_DICT } from './data/kanji';

function App() {
  const writerRef = useRef<HTMLDivElement>(null);
  const [writer, setWriter] = useState<any>(null);
  const [inputText, setInputText] = useState('永');
  const [currentGrade, setCurrentGrade] = useState('小1');
  const [kanjiInfo, setKanjiInfo] = useState({ kun: '-', on: '-', meaning: '...' });
  const [masteredKanji, setMasteredKanji] = useState<string[]>([]);
  const [wrongKanji, setWrongKanji] = useState<string[]>([]);
  const [showImage, setShowImage] = useState<string | null>(null);
  const isComposing = useRef(false);

  const activeKanjiList = currentGrade === 'wrong' ? wrongKanji : (KANJI_GRADES[currentGrade] || []);
  const masteredInCurrent = activeKanjiList.filter(k => masteredKanji.includes(k)).length;
  const progress = activeKanjiList.length > 0 ? Math.round((masteredInCurrent / activeKanjiList.length) * 100) : 0;

  useEffect(() => {
    const savedM = localStorage.getItem('kanji_mastered_list');
    const savedW = localStorage.getItem('kanji_wrong_list');
    if (savedM) setMasteredKanji(JSON.parse(savedM));
    if (savedW) setWrongKanji(JSON.parse(savedW));
    initWriter(inputText);
  }, []);

  const fetchKanjiData = async (char: string) => {
    if (OVERRIDE_DICT[char]) {
      setKanjiInfo(OVERRIDE_DICT[char]);
      return;
    }
    try {
      const res = await fetch(`https://kanjiapi.dev/v1/kanji/${encodeURIComponent(char)}`);
      if (res.ok) {
        const data: any = await res.json(); // 使用 any 绕过类型检查
        setKanjiInfo({
          kun: data.kun_readings[0] || 'なし',
          on: data.on_readings[0] || 'なし',
          meaning: data.meanings[0] || char
        });
      }
    } catch (e) { console.error(e); }
  };

  const initWriter = (char: string) => {
    if (!/[\u4e00-\u9faf]/.test(char)) return;
    fetchKanjiData(char);
    if (writerRef.current) {
      writerRef.current.innerHTML = '';
      const w = HanziWriter.create(writerRef.current, char, {
        width: 300, height: 300, padding: 30,
        strokeColor: '#BC002D', outlineColor: '#F8F8F8',
        showOutline: true, showHintAfterMisses: 1
      });
      setWriter(w);
      w.animateCharacter();
    }
  };

  return (
    <div style={styles.pageWrapper}>
      <div style={styles.appContainer}>
        {showImage && (
          <div style={styles.modalOverlay} onClick={() => setShowImage(null)}>
            <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
              <h2 style={{color: '#BC002D', marginBottom: '10px'}}>お見事！</h2>
              <img src={showImage} style={styles.resultImg} alt="result" onError={(e: any) => e.target.src="https://images.unsplash.com/photo-1528127269322-539801943592?w=400"} />
              <p style={{fontWeight: 'bold', fontSize: '20px'}}>{inputText}: {kanjiInfo.meaning}</p>
              <button onClick={() => setShowImage(null)} style={styles.closeBtn}>次へ</button>
            </div>
          </div>
        )}

        <div style={styles.progressContainer}>
          <div style={styles.progressText}>
            <span>{currentGrade === 'wrong' ? '弱点克服' : currentGrade} 進行度</span>
            <span>{masteredInCurrent} / {activeKanjiList.length}</span>
          </div>
          <div style={styles.progressBarBg}>
            <div style={{...styles.progressBarFill, width: `${progress}%`}}></div>
          </div>
        </div>

        <nav style={styles.nav}>
          {['小1', '小2', '小3', 'wrong'].map(g => (
            <button key={g} onClick={() => setCurrentGrade(g)}
              style={{...styles.navBtn, 
                backgroundColor: currentGrade === g ? (g === 'wrong' ? '#E74C3C' : '#BC002D') : '#fff', 
                color: currentGrade === g ? '#fff' : (g === 'wrong' ? '#E74C3C' : '#BC002D'),
                borderColor: g === 'wrong' ? '#E74C3C' : '#BC002D'
              }}>{g === 'wrong' ? '弱点克服' : g}</button>
          ))}
        </nav>

        <div style={styles.infoCard}>
          <div style={styles.kanjiMain}>
            <div style={styles.kanjiBig}>{inputText}</div>
            <button onClick={() => {
              const u = new SpeechSynthesisUtterance(inputText); u.lang = 'ja-JP'; window.speechSynthesis.speak(u);
            }} style={styles.audioBtn}>🔊 読み</button>
          </div>
          <div style={styles.readings}>
            <div style={styles.infoRow}><b>訓:</b> {kanjiInfo.kun}</div>
            <div style={styles.infoRow}><b>音:</b> {kanjiInfo.on}</div>
            <div style={styles.meaning}>{kanjiInfo.meaning}</div>
          </div>
        </div>

        <div style={styles.gradeBox}>
          <div style={styles.kanjiList}>
            {[...new Set(activeKanjiList)].map((k) => (
              <button key={k} onClick={() => { setInputText(k); initWriter(k); }} 
                style={{
                  ...styles.miniBtn, 
                  backgroundColor: masteredKanji.includes(k) ? '#FDEFF2' : (wrongKanji.includes(k) ? '#FDEDEC' : '#fff'),
                  borderColor: wrongKanji.includes(k) ? '#E74C3C' : (masteredKanji.includes(k) ? '#BC002D' : '#EEE'),
                  color: wrongKanji.includes(k) ? '#E74C3C' : '#333'
                }}>{k}</button>
            ))}
          </div>
        </div>

        <div style={styles.canvasWrapper}>
          <div style={styles.gridBg}><div style={styles.gridLineH}></div><div style={styles.gridLineV}></div></div>
          <div ref={writerRef} style={styles.canvas}></div>
        </div>

        <div style={styles.buttonGrid}>
          <button onClick={() => writer?.animateCharacter()} style={styles.btnSecondary}>お手本</button>
          <button onClick={() => writer?.quiz({ 
            onMistake: () => {
              if (!wrongKanji.includes(inputText)) {
                const newList = [...wrongKanji, inputText];
                setWrongKanji(newList);
                localStorage.setItem('kanji_wrong_list', JSON.stringify(newList));
              }
            }, 
            onComplete: () => {
              confetti({ particleCount: 150, spread: 70, origin: { y: 0.7 } });
              const newW = wrongKanji.filter(k => k !== inputText);
              setWrongKanji(newW);
              localStorage.setItem('kanji_wrong_list', JSON.stringify(newW));
              if (!masteredKanji.includes(inputText)) {
                const newM = [...masteredKanji, inputText];
                setMasteredKanji(newM);
                localStorage.setItem('kanji_mastered_list', JSON.stringify(newM));
              }
              setShowImage(`/assets/kanji/${inputText}.jpg`);
            } 
          })} style={styles.btnPrimary}>練習開始</button>
        </div>

        <div style={{marginTop: '15px'}}>
          <input type="text" value={inputText}
            onChange={(e) => {
              const v = e.target.value; setInputText(v);
              if (!isComposing.current) {
                const c = v.charAt(v.length - 1);
                if (/[\u4e00-\u9faf]/.test(c)) initWriter(c);
              }
            }}
            onCompositionStart={() => isComposing.current = true}
            onCompositionEnd={(e: any) => {
              isComposing.current = false;
              const c = e.data.charAt(e.data.length - 1);
              if (/[\u4e00-\u9faf]/.test(c)) { setInputText(c); initWriter(c); }
            }}
            style={styles.input} placeholder="検索" />
        </div>

        <footer style={styles.footer}>
          <a href="https://www.facebook.com/zhao123hong/" target="_blank" rel="noopener noreferrer" style={styles.footerLink}>
            © PROTECH株式会社
          </a>
        </footer>
      </div>
    </div>
  );
}

const styles: { [key: string]: any } = {
  pageWrapper: { backgroundColor: '#F0F2F5', minHeight: '100vh', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px 0', fontFamily: "'Noto Sans JP', sans-serif" },
  appContainer: { width: '95%', maxWidth: '500px', backgroundColor: '#FAFAFA', borderRadius: '30px', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '25px', boxShadow: '0 15px 35px rgba(0,0,0,0.1)', position: 'relative' },
  progressContainer: { width: '100%', marginBottom: '20px' },
  progressText: { display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#BC002D', fontWeight: 'bold', marginBottom: '8px' },
  progressBarBg: { width: '100%', height: '10px', backgroundColor: '#EEE', borderRadius: '5px', overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#BC002D', transition: 'width 0.5s ease' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', padding: '30px', borderRadius: '35px', textAlign: 'center', width: '85%', maxWidth: '420px' },
  resultImg: { width: '100%', height: '240px', objectFit: 'cover', borderRadius: '25px', marginBottom: '15px' },
  closeBtn: { backgroundColor: '#BC002D', color: '#fff', border: 'none', padding: '14px 45px', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold' },
  nav: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '20px', justifyContent: 'center' },
  navBtn: { padding: '8px 16px', border: '1px solid', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' },
  infoCard: { backgroundColor: '#fff', width: '100%', padding: '20px', borderRadius: '25px', boxShadow: '0 5px 15px rgba(0,0,0,0.03)', display: 'flex', gap: '25px', marginBottom: '20px' },
  kanjiMain: { textAlign: 'center' },
  kanjiBig: { fontSize: '65px', fontWeight: '700', color: '#333', lineHeight: '1' },
  audioBtn: { marginTop: '8px', fontSize: '11px', border: '1px solid #eee', borderRadius: '12px', backgroundColor: '#fff', cursor: 'pointer', padding: '4px 12px' },
  readings: { flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  infoRow: { fontSize: '14px', marginBottom: '5px' },
  meaning: { fontSize: '12px', color: '#999', fontStyle: 'italic', marginTop: '5px' },
  gradeBox: { backgroundColor: '#fff', padding: '15px', borderRadius: '20px', width: '100%', maxHeight: '140px', overflowY: 'auto', marginBottom: '25px', border: '1px solid #F0F0F0' },
  kanjiList: { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center' },
  miniBtn: { width: '42px', height: '42px', border: '1.5px solid', borderRadius: '10px', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 },
  canvasWrapper: { position: 'relative', width: '300px', height: '300px', marginBottom: '25px', backgroundColor: '#fff', borderRadius: '35px', overflow: 'hidden', boxShadow: '0 10px 30px rgba(0,0,0,0.08)' },
  gridBg: { position: 'absolute', width: '100%', height: '100%', border: '2px solid #BC002D', pointerEvents: 'none', opacity: 0.08 },
  gridLineH: { position: 'absolute', top: '50%', width: '100%', borderTop: '1px dashed #BC002D' },
  gridLineV: { position: 'absolute', left: '50%', height: '100%', borderLeft: '1px dashed #BC002D' },
  canvas: { position: 'relative', zIndex: 1 },
  buttonGrid: { display: 'flex', gap: '15px', width: '100%' },
  btnPrimary: { flex: 2, padding: '18px', backgroundColor: '#BC002D', color: '#fff', border: 'none', borderRadius: '20px', fontWeight: 'bold', fontSize: '20px', cursor: 'pointer' },
  btnSecondary: { flex: 1, padding: '18px', backgroundColor: '#34495E', color: '#fff', border: 'none', borderRadius: '20px', cursor: 'pointer' },
  input: { padding: '12px', fontSize: '18px', width: '90px', textAlign: 'center', border: '1px solid #ddd', borderRadius: '15px' },
  footer: { marginTop: '40px', paddingBottom: '10px' },
  footerLink: { color: '#CCC', textDecoration: 'none', fontSize: '12px' }
};

export default App;