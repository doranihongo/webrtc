export function helpers() {}
export const removeAccents = (str: string) => {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D");
};

export const calculateSRS = (currentData: any, quality: number) => {
    let { level = 0, easeFactor = 2.5, nextReview } = currentData || {};
    const now = Date.now();
    if (nextReview && nextReview > now) {
        if (quality === 1) return currentData;
    }

    if (quality === 0) {
        easeFactor = Math.max(1.3, easeFactor - 0.2);
        return {
            level: 0,           
            easeFactor: easeFactor, 
            nextReview: 0,     
            isDone: false
        };
    } else {
        let newInterval;
        if (!nextReview || nextReview === 0 || level === 0) {
            newInterval = 1; 
        } else {
            newInterval = Math.ceil(level * easeFactor);
            easeFactor = Math.min(2.5, easeFactor + 0.1); 
        }

        const nextDate = new Date();
        nextDate.setDate(nextDate.getDate() + newInterval);
        nextDate.setHours(5, 0, 0, 0);

        return {
            level: newInterval, 
            easeFactor: easeFactor,
            nextReview: nextDate.getTime(),
            isDone: false 
        };
    }
};

export const checkIsKatakana = (str: string) => {
    return /[\u30A0-\u30FF]/.test(str);
};

export const convertToKana = (rawText: string, targetKanaString: any) => {
    const hiraMap: any = {
        'a':'あ','i':'い','u':'う','e':'え','o':'お','ka':'か','ki':'き','ku':'く','ke':'け','ko':'こ','sa':'さ','shi':'し','si':'し','su':'す','se':'せ','so':'そ','ta':'た','chi':'ち','ti':'ち','tsu':'つ','tu':'つ','te':'て','to':'と','na':'な','ni':'に','nu':'ぬ','ne':'ね','no':'の','ha':'は','hi':'ひ','fu':'ふ','hu':'ふ','he':'へ','ho':'ほ','ma':'ま','mi':'み','mu':'む','me':'め','mo':'も','ya':'や','yu':'ゆ','yo':'よ','ra':'ら','ri':'り','ru':'る','re':'れ','ro':'ろ','wa':'わ','wo':'を','nn':'ん','ga':'が','gi':'ぎ','gu':'ぐ','ge':'げ','go':'ご','za':'ざ','ji':'じ','zi':'じ','zu':'ず','ze':'ぜ','zo':'ぞ','da':'だ','di':'ぢ','du':'づ','de':'で','do':'ど','ba':'ば','bi':'び','bu':'ぶ','be':'べ','bo':'ぼ','pa':'ぱ','pi':'ぴ','pu':'ぷ','pe':'ぺ','po':'ぽ','kya':'きゃ','kyu':'きゅ','kyo':'きょ','sha':'しゃ','shu':'しゅ','sho':'しょ','sya':'しゃ','syu':'しゅ','syo':'しょ','cha':'ちゃ','chu':'ちゅ','cho':'ちょ','tya':'ちゃ','tyu':'ちゅ','tyo':'ちょ','nya':'にゃ','nyu':'にゅ','nyo':'にょ','hya':'ひゃ','hyu':'ひゅ','hyo':'ひょ','mya':'みゃ','myu':'みゅ','myo':'みょ','rya':'りゃ','ryu':'りゅ','ryo':'りょ','gya':'ぎゃ','gyu':'ぎゅ','gyo':'ぎょ','ja':'じゃ','ju':'じゅ','jo':'じょ','zya':'じゃ','zyu':'じゅ','zyo':'じょ','bya':'びゃ','byu':'びゅ','byo':'びょ','pya':'ぴゃ','pyu':'ぴゅ','pyo':'ぴょ','fa':'ふぁ','fi':'ふぃ','fe':'ふぇ','fo':'ふぉ','va':'ゔぁ','vi':'ゔぃ','vu':'ゔ','ve':'ゔぇ','vo':'ゔぉ','-':'ー'};
    let result = rawText.toLowerCase();
    result = result.replace(/([bcdfghjklmpqrstvwxyz])\1/g, (match, p1) => p1 === 'n' ? match : 'っ' + p1);
    const keys = Object.keys(hiraMap).sort((a, b) => b.length - a.length);
    for (let key of keys) { result = result.split(key).join(hiraMap[key]); }
    result = result.replace(/n(?=[bcdfghjklmprstvwz])/g, 'ん');

    if (targetKanaString && typeof targetKanaString === 'string') {
        let mixedResult = '';
        for (let i = 0; i < result.length; i++) {
            const char = result[i];
            const targetChar = targetKanaString[i];

            if (targetChar && /[\u30A0-\u30FF]/.test(targetChar)) {
                const code = char.charCodeAt(0);
                if (code >= 12353 && code <= 12435) {
                    mixedResult += String.fromCharCode(code + 96);
                } else {
                    mixedResult += char;
                }
            } else {
                mixedResult += char; 
            }
        }
        return mixedResult;
    }

    return result;
};
