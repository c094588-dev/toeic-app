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
