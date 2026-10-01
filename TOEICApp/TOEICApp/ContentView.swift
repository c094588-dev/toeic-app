import SwiftUI

struct ContentView: View {
    @StateObject private var store = WordStore()
    @State private var selectedLevel: Int? = nil
    @State private var selectedMode: StudyMode? = nil
    @State private var isQuiz = false

    var body: some View {
        if let level = selectedLevel, isQuiz {
            QuizView(store: store, level: level) {
                isQuiz = false
            }
        } else if let level = selectedLevel, selectedMode != nil {
            StudyView(store: store, level: level) {
                selectedLevel = nil
                selectedMode = nil
            }
        } else if let level = selectedLevel {
            ModeSelectView(store: store, level: level) { mode in
                store.buildStudyQueue(band: level, mode: mode)
                selectedMode = mode
            } onQuiz: {
                isQuiz = true
            } onBack: {
                selectedLevel = nil
            }
        } else {
            LevelSelectView(store: store) { level in
                selectedLevel = level
            }
        }
    }
}

// MARK: - Level Select

struct LevelSelectView: View {
    @ObservedObject var store: WordStore
    let onSelect: (Int) -> Void

    private var toiecLevels: [Int] { store.availableScoreBands.filter { $0 >= 500 } }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 10) {
                    ForEach(toiecLevels, id: \.self) { level in
                        LevelRowView(
                            title: "TOEIC \(level)点",
                            subtitle: levelDescription(level),
                            mastered: store.masteredCount(for: level),
                            total: store.totalCount(for: level),
                            action: { onSelect(level) }
                        )
                    }
                }
                .padding(.horizontal, 16)
                .padding(.top, 8)
                .padding(.bottom, 20)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("TOEIC英単語")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    private func levelDescription(_ level: Int) -> String {
        switch level {
        case 500: return "基礎レベル・必須単語"
        case 600: return "初中級レベル"
        case 700: return "中級レベル"
        case 800: return "中上級レベル"
        case 900: return "上級レベル"
        default:  return ""
        }
    }
}

struct LevelRowView: View {
    let title: String
    let subtitle: String
    let mastered: Int
    let total: Int
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                HStack {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(.headline)
                            .foregroundColor(.primary)
                        Text(subtitle)
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 2) {
                        Text("\(mastered) / \(total)")
                            .font(.subheadline.bold())
                            .foregroundColor(.green)
                        Text("覚えた")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    Image(systemName: "chevron.right")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .padding(.leading, 4)
                }
                ProgressView(value: total > 0 ? Double(mastered) / Double(total) : 0)
                    .tint(.green)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }
}

// MARK: - Mode Select

struct ModeSelectView: View {
    @ObservedObject var store: WordStore
    let level: Int
    let onSelect: (StudyMode) -> Void
    let onQuiz: () -> Void
    let onBack: () -> Void

    var body: some View {
        NavigationStack {
            List {
                Section {
                    VStack(spacing: 6) {
                        Text("出題範囲を選択")
                            .font(.title3.bold())
                        Text("TOEIC \(level)点レベル")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .listRowBackground(Color.clear)
                }

                Section {
                    Button(action: { onSelect(.unmasteredOnly) }) {
                        HStack(spacing: 16) {
                            Image(systemName: "graduationcap")
                                .font(.title2)
                                .foregroundColor(.blue)
                                .frame(width: 40)
                            VStack(alignment: .leading, spacing: 3) {
                                Text("覚えていない単語のみ")
                                    .font(.headline)
                                    .foregroundColor(.primary)
                                let remaining = store.totalCount(for: level) - store.masteredCount(for: level)
                                Text("未学習 + まだ（\(remaining)語）")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 6)
                    }

                    Button(action: { onSelect(.all) }) {
                        HStack(spacing: 16) {
                            Image(systemName: "books.vertical")
                                .font(.title2)
                                .foregroundColor(.purple)
                                .frame(width: 40)
                            VStack(alignment: .leading, spacing: 3) {
                                Text("全問出題（覚えたものも含む）")
                                    .font(.headline)
                                    .foregroundColor(.primary)
                                Text("全\(store.totalCount(for: level))語")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 6)
                    }
                } header: {
                    Text("フラッシュカード")
                }

                Section {
                    Button(action: onQuiz) {
                        HStack(spacing: 16) {
                            Image(systemName: "checklist")
                                .font(.title2)
                                .foregroundColor(.orange)
                                .frame(width: 40)
                            VStack(alignment: .leading, spacing: 3) {
                                Text("4択クイズ（10問）")
                                    .font(.headline)
                                    .foregroundColor(.primary)
                                Text("覚えていない単語から優先して出題・間違えたら「まだ」に")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                            Spacer()
                            Image(systemName: "chevron.right")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .padding(.vertical, 6)
                    }
                } header: {
                    Text("テスト")
                }
            }
            .listStyle(.insetGrouped)
            .navigationTitle("TOEIC \(level)点")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(true)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: onBack) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                            Text("レベル選択")
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Study

struct StudyView: View {
    @ObservedObject var store: WordStore
    let level: Int
    let onBack: () -> Void

    @State private var isRevealed = false
    @State private var markedMastered: Bool? = nil
    @State private var dragOffset: CGFloat = 0
    @State private var cardOpacity: Double = 1.0

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                if !store.studyQueue.isEmpty {
                    HStack {
                        Text("\(store.queueIndex + 1) / \(store.studyQueue.count)")
                            .font(.caption)
                            .foregroundColor(.secondary)
                        Spacer()
                        HStack(spacing: 10) {
                            statBadge(count: store.masteredCount(for: level), label: "覚えた", color: .green)
                            statBadge(count: store.notYetIds.count, label: "まだ", color: .orange)
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, 10)
                }

                ZStack {
                    if let word = store.currentQueueWord {
                        FlashCardView(
                            word: word,
                            isRevealed: $isRevealed,
                            markedMastered: markedMastered,
                            onMark: { mastered in
                                handleMark(wordId: word.id, mastered: mastered)
                            },
                            onRevertToNotYet: {
                                store.markNotYet(id: word.id)
                                markedMastered = false
                            }
                        )
                        .padding(.horizontal, 20)
                        .offset(x: dragOffset)
                        .opacity(cardOpacity)
                    } else {
                        VStack(spacing: 12) {
                            Image(systemName: "checkmark.circle.fill")
                                .font(.system(size: 60))
                                .foregroundColor(.green)
                            Text("全ての単語を学習しました！")
                                .foregroundColor(.secondary)
                        }
                    }
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .contentShape(Rectangle())
                .onTapGesture {
                    if isRevealed { handleNext() }
                }
            }
            .navigationTitle("TOEIC \(level)点")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(true)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: onBack) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                            Text("レベル選択")
                        }
                    }
                }
            }
            .background(Color(.systemGroupedBackground))
        }
    }

    private func handleMark(wordId: Int, mastered: Bool) {
        if mastered { store.markMastered(id: wordId) }
        else        { store.markNotYet(id: wordId) }
        markedMastered = mastered
        withAnimation(.easeOut(duration: 0.25)) { isRevealed = true }
    }

    private func handleNext() {
        withAnimation(.easeIn(duration: 0.18)) {
            dragOffset = -400
            cardOpacity = 0
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.18) {
            store.advanceQueue()
            isRevealed = false
            markedMastered = nil
            dragOffset = 400
            withAnimation(.easeOut(duration: 0.18)) {
                dragOffset = 0
                cardOpacity = 1
            }
        }
    }

    private func statBadge(count: Int, label: String, color: Color) -> some View {
        HStack(spacing: 4) {
            Text("\(count)").fontWeight(.semibold).foregroundColor(color)
            Text(label).foregroundColor(.secondary)
        }
        .font(.caption)
    }
}
