import Foundation

struct Word: Codable, Identifiable {
    let id: Int
    let word: String
    let meaning: String
    let example: String
    let scoreBand: Int
    let importance: String

    enum CodingKeys: String, CodingKey {
        case id = "No"
        case word
        case meaning
        case example
        case scoreBand = "score_band"
        case importance
    }
}

// MARK: - レベル表示（score_band 100〜300 はキッズ、500以上はTOEIC）

enum Level {
    static func isKids(_ band: Int) -> Bool { band < 500 }

    /// 一覧・ナビゲーション用のタイトル
    static func title(_ band: Int) -> String {
        isKids(band) ? "キッズ Lv.\(band / 100)" : "TOEIC \(band)点"
    }

    /// カードのバッジ用の短い表記
    static func badge(_ band: Int) -> String {
        isKids(band) ? "キッズ Lv.\(band / 100)" : "TOEIC \(band)"
    }

    static func description(_ band: Int) -> String {
        switch band {
        case 100: return "はじめての英単語（色・家族・食べ物など）"
        case 200: return "身近な生活の単語（学校・食事・天気など）"
        case 300: return "ひろがる単語（自然・からだ・服など）"
        case 500: return "基礎レベル・必須単語"
        case 600: return "初中級レベル"
        case 700: return "中級レベル"
        case 800: return "中上級レベル"
        case 900: return "上級レベル"
        default:  return ""
        }
    }
}
