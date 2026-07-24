package com.cbofertas.v6.data

import android.content.Context
import org.json.JSONObject

class PhraseLibrary(private val context: Context) {
    private val prefs = context.getSharedPreferences("cbofertas_v6_phrases", Context.MODE_PRIVATE)
    private val groups: Map<String, List<String>> by lazy {
        val text = context.assets.open("funny_phrases.json").bufferedReader().use { it.readText() }
        val json = JSONObject(text)
        json.keys().asSequence().associateWith { key ->
            val array = json.getJSONArray(key)
            buildList { for (index in 0 until array.length()) add(array.getString(index)) }
        }
    }

    fun next(title: String): String {
        val category = category(title)
        val choices = groups[category].orEmpty().ifEmpty { groups["default"].orEmpty() }
        if (choices.isEmpty()) return "Não é fofoca: esse preço realmente caiu."
        val last = prefs.getString("last_$category", null)
        val available = choices.filterNot { it == last }.ifEmpty { choices }
        val selected = available.random()
        prefs.edit().putString("last_$category", selected).apply()
        return selected
    }

    private fun category(title: String): String {
        val value = title.lowercase()
        return when {
            Regex("cueca|calcinha|sutiã|lingerie|roupa íntima").containsMatchIn(value) -> "roupas_intimas"
            Regex("hidratante|loção corporal").containsMatchIn(value) -> "hidratacao"
            Regex("doce|chocolate|bombom|paçoca|brigadeiro").containsMatchIn(value) -> "doces"
            Regex("creatina|whey|suplemento|pré-treino|bcaa").containsMatchIn(value) -> "suplementos"
            Regex("cadeira|poltrona|assento gamer").containsMatchIn(value) -> "cadeiras"
            Regex("perfume|colônia|body splash").containsMatchIn(value) -> "perfumes"
            Regex("escova de dentes|pasta de dente|fio dental|higiene oral").containsMatchIn(value) -> "higiene_oral"
            Regex("papel higiênico|lenço umedecido").containsMatchIn(value) -> "higiene_pessoal"
            Regex("controle|playstation|xbox|gamepad|videogame").containsMatchIn(value) -> "games"
            Regex("fone|headset|earbud|caixa de som|soundbar").containsMatchIn(value) -> "audio"
            Regex("air fryer|fritadeira sem óleo").containsMatchIn(value) -> "air_fryer"
            Regex("tênis|sapato|sandália|chinelo|bota").containsMatchIn(value) -> "calcados"
            Regex("camiseta|camisa|vestido|calça|bermuda|moletom|jaqueta").containsMatchIn(value) -> "roupas"
            Regex("panela|cafeteira|liquidificador|frigideira|cozinha").containsMatchIn(value) -> "cozinha"
            Regex("sofá|colchão|aspirador|geladeira|lavadora|casa|tapete|toalha").containsMatchIn(value) -> "casa"
            Regex("celular|smartphone|iphone|galaxy|xiaomi|tv|notebook|tablet|monitor").containsMatchIn(value) -> "tecnologia"
            Regex("maquiagem|shampoo|beleza|batom|secador|protetor solar").containsMatchIn(value) -> "beleza"
            Regex("academia|fitness|bicicleta|esteira|esporte|treino").containsMatchIn(value) -> "fitness"
            Regex("brinquedo|bebê|infantil|criança|boneca|fralda").containsMatchIn(value) -> "infantil"
            Regex("pet|cachorro|gato|ração|coleira").containsMatchIn(value) -> "pet"
            Regex("carro|moto|pneu|capacete|automotivo").containsMatchIn(value) -> "automotivo"
            else -> "default"
        }
    }
}
