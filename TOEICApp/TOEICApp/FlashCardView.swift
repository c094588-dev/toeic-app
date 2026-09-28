import SwiftUI
import AVFoundation

struct FlashCardView: View {
    let word: Word
    @Binding var isRevealed: Bool
    let markedMastered: Bool?   // true=覚えた, false=まだ, nil=未マーク
    let onMark: (Bool) -> Void
    let onRevertToNotYet: () -> Void

    @State private var synthesizer = AVSpeechSynthesizer()

    var body: some View {
        VStack(spacing: 0) {
            // バッジ
            HStack {
                Label("TOEIC \(word.scoreBand)", systemImage: "chart.bar.fill")
                    .font(.caption)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(bandColor(word.scoreBand).opacity(0.2))
                    .foregroundColor(bandColor(word.scoreBand))
                    .clipShape(Capsule())

                Spacer()

                Text(word.importance)
                    .font(.caption)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(importanceColor(word.importance).opacity(0.2))
                    .foregroundColor(importanceColor(word.importance))
                    .clipShape(Capsule())
            }
            .padding(.horizontal, 20)
            .padding(.top, 20)

            Spacer()

            // 英単語（長い場合は自動縮小して1行に収める）
            Text(word.word)
                .font(.system(size: 52, weight: .bold, design: .rounded))
                .minimumScaleFactor(0.4)
                .lineLimit(1)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 24)

            Spacer()

            if isRevealed {
                Divider()
                    .padding(.horizontal, 20)

                VStack(spacing: 12) {
                    // 意味 + スピーカーボタン
                    HStack(alignment: .center, spacing: 10) {
                        Text(word.meaning)
                            .font(.title2)
                            .fontWeight(.semibold)
                            .multilineTextAlignment(.center)

                        Button(action: speakWord) {
                            Image(systemName: "speaker.wave.2.fill")
                                .font(.title3)
                                .foregroundColor(.accentColor)
                        }
                    }

                    Text(word.example)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .italic()
                }
                .padding(.horizontal, 20)
                .padding(.top, 16)
                .transition(.opacity.combined(with: .move(edge: .bottom)))

                HStack {
                    // 「覚えた」で進んだときだけ「やっぱりまだ」を表示
                    if markedMastered == true {
                        Button(action: onRevertToNotYet) {
                            Text("やっぱりまだ")
                                .font(.caption)
                                .foregroundColor(.orange)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 6)
                                .background(Color.orange.opacity(0.12))
                                .clipShape(Capsule())
                        }
                    }
                    Spacer()
                    Text("タップして次へ")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                .padding(.horizontal, 20)
                .padding(.top, 8)
                .padding(.bottom, 20)
                .transition(.opacity)

            } else {
                // まだ / 覚えた ボタン（大きめ）
                HStack(spacing: 16) {
                    Button(action: { onMark(false) }) {
                        Text("まだ")
                            .font(.title2.bold())
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 22)
                            .background(Color.orange)
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }

                    Button(action: { onMark(true) }) {
                        Text("覚えた")
                            .font(.title2.bold())
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 22)
                            .background(Color.green)
                            .foregroundColor(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 16))
                    }
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }
        }
        .frame(maxWidth: .infinity)
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .shadow(color: .black.opacity(0.08), radius: 16, x: 0, y: 4)
    }

    private func speakWord() {
        synthesizer.stopSpeaking(at: .immediate)
        let utterance = AVSpeechUtterance(string: word.word)
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
        utterance.rate = 0.45
        synthesizer.speak(utterance)
    }

    private func bandColor(_ band: Int) -> Color {
        switch band {
        case 500: return .green
        case 600: return .blue
        case 700: return .orange
        case 800: return .purple
        default:  return .red
        }
    }

    private func importanceColor(_ importance: String) -> Color {
        switch importance {
        case "必須": return .red
        case "重要": return .orange
        default:    return .gray
        }
    }
}
