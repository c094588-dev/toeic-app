import Foundation

enum StudyMode {
    case all            // 全問（覚えたものも含む）
    case unmasteredOnly // 覚えていないものだけ
}

class WordStore: ObservableObject {
    @Published var allWords: [Word] = []
    @Published var selectedScoreBand: Int? = nil

    // 覚えた・まだのIDセット（iCloud + UserDefaultsに二重保存）
    @Published var masteredIds: Set<Int> = [] {
        didSet { save(masteredIds, key: "masteredIds") }
    }
    @Published var notYetIds: Set<Int> = [] {
        didSet { save(notYetIds, key: "notYetIds") }
    }

    // スタディキュー
    @Published var studyQueue: [Word] = []
    @Published var queueIndex: Int = 0
    private var currentMode: StudyMode = .unmasteredOnly
    private var recentIds: [Int] = []   // 直近に出した単語ID（境界での重複防止）

    var currentQueueWord: Word? {
        guard !studyQueue.isEmpty else { return nil }
        return studyQueue[queueIndex]
    }

    var availableScoreBands: [Int] {
        Array(Set(allWords.map { $0.scoreBand })).sorted()
    }

    init() {
        masteredIds = load(key: "masteredIds")
        notYetIds   = load(key: "notYetIds")
        loadWords()

        // iCloudの初期同期を要求
        NSUbiquitousKeyValueStore.default.synchronize()

        // 別デバイスからiCloudが更新されたときに反映
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(iCloudDidChangeExternally(_:)),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: NSUbiquitousKeyValueStore.default
        )
    }

    @objc private func iCloudDidChangeExternally(_ notification: Notification) {
        DispatchQueue.main.async {
            self.masteredIds = self.load(key: "masteredIds")
            self.notYetIds   = self.load(key: "notYetIds")
        }
    }

    func loadWords() {
        guard let url = Bundle.main.url(forResource: "words", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let decoded = try? JSONDecoder().decode([Word].self, from: data)
        else { return }
        allWords = decoded
    }

    // MARK: - Study Queue

    func buildStudyQueue(band: Int, mode: StudyMode) {
        selectedScoreBand = band
        currentMode = mode
        recentIds = []

        let pool = makePool(band: band, mode: mode)
        studyQueue = shuffled(pool, avoiding: [])
        queueIndex = 0
    }

    func advanceQueue() {
        guard !studyQueue.isEmpty else { return }

        // 直近IDを記録（最大50件）
        if let current = currentQueueWord {
            recentIds.append(current.id)
            if recentIds.count > 50 { recentIds.removeFirst() }
        }

        let next = queueIndex + 1
        if next >= studyQueue.count {
            // キュー末尾 → 再シャッフル（直近50問と被らないように）
            if let band = selectedScoreBand {
                let pool = makePool(band: band, mode: currentMode)
                studyQueue = shuffled(pool, avoiding: recentIds)
                queueIndex = 0
            }
        } else {
            queueIndex = next
        }
    }

    private func makePool(band: Int, mode: StudyMode) -> [Word] {
        switch mode {
        case .all:
            return allWords.filter { $0.scoreBand == band }
        case .unmasteredOnly:
            let unmastered = allWords.filter { $0.scoreBand == band && !masteredIds.contains($0.id) }
            // 全部覚えた場合は全問表示（おさらい）
            return unmastered.isEmpty ? allWords.filter { $0.scoreBand == band } : unmastered
        }
    }

    /// シャッフルし、先頭が avoiding リストの単語にならないよう調整
    private func shuffled(_ pool: [Word], avoiding recent: [Int]) -> [Word] {
        var arr = pool.shuffled()
        guard arr.count > 1, !recent.isEmpty else { return arr }

        let recentSet = Set(recent)
        // 先頭に直近IDの単語が来ていたら、来ていない位置と交換
        if let firstId = arr.first?.id, recentSet.contains(firstId) {
            if let swapIdx = arr.indices.dropFirst().first(where: { !recentSet.contains(arr[$0].id) }) {
                arr.swapAt(0, swapIdx)
            }
        }
        return arr
    }

    // MARK: - Mark

    func markMastered(id: Int) {
        masteredIds.insert(id)
        notYetIds.remove(id)
    }

    func markNotYet(id: Int) {
        notYetIds.insert(id)
        masteredIds.remove(id)
    }

    // MARK: - Stats

    func masteredCount(for band: Int) -> Int {
        allWords.filter { $0.scoreBand == band && masteredIds.contains($0.id) }.count
    }

    func totalCount(for band: Int) -> Int {
        allWords.filter { $0.scoreBand == band }.count
    }

    // MARK: - 永続化（iCloud優先、UserDefaultsをローカルキャッシュとして併用）

    private func save(_ set: Set<Int>, key: String) {
        let array = Array(set)
        // iCloudに保存
        NSUbiquitousKeyValueStore.default.set(array, forKey: key)
        NSUbiquitousKeyValueStore.default.synchronize()
        // ローカルにもキャッシュ（オフライン時のフォールバック）
        UserDefaults.standard.set(array, forKey: key)
    }

    private func load(key: String) -> Set<Int> {
        // iCloudから読み込み、なければUserDefaultsにフォールバック
        if let array = NSUbiquitousKeyValueStore.default.array(forKey: key) as? [Int], !array.isEmpty {
            return Set(array)
        }
        let local = UserDefaults.standard.array(forKey: key) as? [Int] ?? []
        return Set(local)
    }
}
