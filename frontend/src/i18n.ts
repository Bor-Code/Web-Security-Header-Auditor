import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

const resources = {
  en: {
    translation: {
      app: {
        eyebrow: 'Passive Header Automation',
        title: 'Web Security Header Auditor',
        api: 'API Online',
        target: 'target',
        runAudit: 'Run Audit',
        scanning: 'Scanning',
        batchMode: 'Batch Mode',
        batchTitle: 'Multi Target Scan',
        queued: 'queued',
        complete: 'complete',
        runBatch: 'Run Batch',
        batchRunning: 'Batch Running',
        batchHelp:
          'Add one URL per line. The GUI sends passive audit requests to the local API.',
        batchEmpty:
          'Batch results will appear here after the first multi target run.',
        completed: 'Completed',
        averageScore: 'Average Score',
        lowestScore: 'Lowest Score',
        highPriority: 'High Priority',
        weakestTarget: 'Weakest Target',
        copySummary: 'Copy Summary',
        postureScore: 'posture score',
        scanPipeline: 'scan pipeline',
        resolveUrl: 'Resolve URL',
        fetchHeaders: 'Fetch Headers',
        scorePosture: 'Score Posture',
        buildNotes: 'Build Notes',
        present: 'Present',
        missing: 'Missing',
        total: 'Total',
        notes: 'Notes',
        recentRuns: 'Recent Runs',
        scanHistory: 'Scan History',
        storedLocally: 'stored locally',
        historyEmpty: 'Completed scans will be listed here during this session.',
        securityControls: 'Security Controls',
        headerMatrix: 'Header Matrix',
        matrixEmpty:
          'Enter a target and run an audit to populate the control matrix.',
        reviewQueue: 'Review Queue',
        analystNotes: 'Analyst Notes',
        notesEmpty:
          'Findings and remediation notes will appear here after the scan.',
        noScanData: 'No scan data',
        idle: 'idle',
        awaiting: 'Awaiting first scan',
        controlsChecked: 'controls checked',
        items: 'items',
        downloadJson: 'Download JSON',
      },
    },
  },
  tr: {
    translation: {
      app: {
        eyebrow: 'Pasif Header Otomasyonu',
        title: 'Web Güvenlik Header Denetleyici',
        api: 'API Aktif',
        target: 'hedef',
        runAudit: 'Denetle',
        scanning: 'Taranıyor',
        batchMode: 'Toplu Mod',
        batchTitle: 'Çoklu Hedef Taraması',
        queued: 'sırada',
        complete: 'tamamlandı',
        runBatch: 'Toplu Tara',
        batchRunning: 'Toplu Tarama',
        batchHelp:
          'Her satıra bir URL ekle. Arayüz yerel API’ye pasif denetim isteği gönderir.',
        batchEmpty:
          'İlk çoklu hedef taramasından sonra sonuçlar burada görünecek.',
        completed: 'Tamamlanan',
        averageScore: 'Ortalama Skor',
        lowestScore: 'En Düşük Skor',
        highPriority: 'Yüksek Öncelik',
        weakestTarget: 'En Zayıf Hedef',
        copySummary: 'Özeti Kopyala',
        postureScore: 'güvenlik skoru',
        scanPipeline: 'tarama akışı',
        resolveUrl: 'URL Çöz',
        fetchHeaders: 'Header Al',
        scorePosture: 'Skorla',
        buildNotes: 'Not Üret',
        present: 'Mevcut',
        missing: 'Eksik',
        total: 'Toplam',
        notes: 'Not',
        recentRuns: 'Son Taramalar',
        scanHistory: 'Tarama Geçmişi',
        storedLocally: 'yerel kayıt',
        historyEmpty:
          'Tamamlanan taramalar bu oturum boyunca burada listelenecek.',
        securityControls: 'Güvenlik Kontrolleri',
        headerMatrix: 'Header Matrisi',
        matrixEmpty:
          'Bir hedef girip denetim çalıştırınca kontrol matrisi dolacak.',
        reviewQueue: 'İnceleme Kuyruğu',
        analystNotes: 'Analist Notları',
        notesEmpty:
          'Bulgular ve iyileştirme notları taramadan sonra burada görünecek.',
        noScanData: 'Tarama verisi yok',
        idle: 'boşta',
        awaiting: 'İlk tarama bekleniyor',
        controlsChecked: 'kontrol denetlendi',
        items: 'madde',
        downloadJson: 'JSON İndir',
      },
    },
  },
}

void i18n.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
})

export default i18n