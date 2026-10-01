import SwiftUI
import AVFoundation

// MARK: - 4択クイズ

struct QuizView: View {
    @ObservedObject var store: WordStore
    let level: Int
    let onBack: () -> Void

    @State private var questions: [QuizQuestion] = []
    @State private var index = 0
    @State private var selectedIndex: Int? = nil
    @State private var wrongWords: [Word] = []
    @State private var correctCount = 0
    @State private var synthesizer = AVSpeechSynthesizer()

    private var isFinished: Bool { !questions.isEmpty && index >= questions.count }

    var body: some View {
        NavigationStack {
            Group {
                if questions.isEmpty {
                    Text("出題できる単語がありません")
                        .foregroundColor(.secondary)
                } else if isFinished {
                    resultView
                } else {
                    questionView(questions[index])
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemGroupedBackground))
            .navigationTitle("TOEIC \(level)点 クイズ")
            .navigationBarTitleDisplayMode(.inline)
            .navigationBarBackButtonHidden(true)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button(action: onBack) {
                        HStack(spacing: 4) {
                            Image(systemName: "chevron.left")
                            Text("戻る")
                        }
                    }
                }
            }
        }
        .onAppear { if questions.isEmpty { startQuiz() } }
    }

    // MARK: 問題画面

    private func questionView(_ q: QuizQuestion) -> some View {
        VStack(spacing: 16) {
            HStack {
                Text("\(index + 1) / \(questions.count)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                Spacer()
                Text("正解 \(correctCount)")
                    .font(.caption.weight(.semibold))
                    .foregroundColor(.green)
            }
            ProgressView(value: Double(index), total: Double(questions.count))
                .tint(.blue)

            Spacer()

            HStack(spacing: 10) {
                Text(q.word.word)
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .minimumScaleFactor(0.4)
                    .lineLimit(1)
                Button(action: { speak(q.word.word) }) {
                    Image(systemName: "speaker.wave.2.fill")
                        .font(.title3)
                }
            }

            if selectedIndex != nil {
                Text(q.word.example)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .transition(.opacity)
            }

            Spacer()

            VStack(spacing: 10) {
                ForEach(q.choices.indices, id: \.self) { i in
                    Button(action: { answer(q, choice: i) }) {
                        HStack {
                            Text(q.choices[i])
                                .multilineTextAlignment(.leading)
                            Spacer()
                            if let mark = choiceMark(q, i) {
                                Image(systemName: mark)
                            }
                        }
                        .font(.body.weight(.medium))
                        .foregroundColor(choiceForeground(q, i))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 14)
                        .frame(maxWidth: .infinity)
                        .background(choiceBackground(q, i))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .disabled(selectedIndex != nil)
                }
            }

            Button(action: next) {
                Text(index + 1 == questions.count ? "結果を見る" : "次へ")
                    .font(.headline)
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 14)
                    .background(Color.blue)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .opacity(selectedIndex == nil ? 0 : 1)
            .disabled(selectedIndex == nil)
        }
        .padding(20)
    }

    // MARK: 結果画面

    private var resultView: some View {
        List {
            Section {
                VStack(spacing: 8) {
                    Text("\(correctCount) / \(questions.count)")
                        .font(.system(size: 48, weight: .bold, design: .rounded))
                    Text(resultMessage)
                        .foregroundColor(.secondary)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .listRowBackground(Color.clear)
            }

            if !wrongWords.isEmpty {
                Section("間違えた単語（「まだ」に追加しました）") {
                    ForEach(wrongWords) { word in
                        HStack {
                            Text(word.word).fontWeight(.semibold)
                            Spacer()
                            Text(word.meaning)
                                .foregroundColor(.secondary)
                                .multilineTextAlignment(.trailing)
                        }
                    }
                }
            }

            Section {
                Button("もう一度挑戦する", action: startQuiz)
                Button("戻る", action: onBack)
            }
        }
        .listStyle(.insetGrouped)
    }

    private var resultMessage: String {
        let rate = Double(correctCount) / Double(max(questions.count, 1))
        switch rate {
        case 1.0:      return "全問正解！"
        case 0.8...:   return "よくできました"
        case 0.5...:   return "あと少し！"
        default:       return "フラッシュカードで復習しよう"
        }
    }

    // MARK: 操作

    private func startQuiz() {
        questions = store.makeQuiz(band: level)
        index = 0
        selectedIndex = nil
        wrongWords = []
        correctCount = 0
    }

    private func answer(_ q: QuizQuestion, choice: Int) {
        guard selectedIndex == nil else { return }
        withAnimation(.easeOut(duration: 0.2)) { selectedIndex = choice }
        if choice == q.correctIndex {
            correctCount += 1
        } else {
            wrongWords.append(q.word)
            store.markNotYet(id: q.word.id)
        }
    }

    private func next() {
        selectedIndex = nil
        index += 1
    }

    private func speak(_ text: String) {
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.45
        synthesizer.speak(utterance)
    }

    // MARK: 選択肢の見た目

    private func choiceBackground(_ q: QuizQuestion, _ i: Int) -> Color {
        guard let selected = selectedIndex else { return Color(.secondarySystemGroupedBackground) }
        if i == q.correctIndex { return .green }
        if i == selected { return .red }
        return Color(.secondarySystemGroupedBackground)
    }

    private func choiceForeground(_ q: QuizQuestion, _ i: Int) -> Color {
        guard let selected = selectedIndex else { return .primary }
        return (i == q.correctIndex || i == selected) ? .white : .secondary
    }

    private func choiceMark(_ q: QuizQuestion, _ i: Int) -> String? {
        guard let selected = selectedIndex else { return nil }
        if i == q.correctIndex { return "checkmark.circle.fill" }
        if i == selected { return "xmark.circle.fill" }
        return nil
    }
}
