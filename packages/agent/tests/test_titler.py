import re

STOP_WORDS = {
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your', 'yours',
    'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'having', 'do', 'does', 'did', 'doing', 'a', 'an', 'the', 'and', 'but',
    'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for',
    'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before',
    'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on',
    'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
    'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same',
    'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don',
    'should', 'now', 'need', 'want', 'please', 'make', 'create', 'write', 'build',
    'dev', 'give', 'show', 'tell', 'help', 'like', 'based', 'using', 'propose',
    'develop', 'search', 'across', 'best', 'verified', 'run', 'between', 'let', 'lets'
}

QUANT_KEYWORDS = {
    'smc', 'ict', 'fvg', 'ob', 'bos', 'choch', 'orderblock', 'imbalance',
    'atr', 'rsi', 'macd', 'ema', 'sma', 'vwap', 'bollinger', 'bands',
    'scalper', 'scalping', 'breakout', 'mean_reversion', 'grid', 'martingale',
    'gold', 'xauusd', 'btcusdt', 'btc', 'eth', 'eurusd', 'gbpusd',
    '1h', '4h', '15m', '5m', '1m', 'd1', 'h1', 'h4', 'm15', 'm5', 'm1',
    'ea', 'mql5', 'python', 'polars', 'backtest', 'sweep', 'matrix', 'transpile',
    'strategy', 'alpha', 'trailing', 'stop', 'risk', 'arbitrage'
}

ACRONYMS = {'smc', 'ict', 'fvg', 'ob', 'bos', 'choch', 'atr', 'rsi', 'macd', 'ema', 'sma', 'vwap', 'ea', 'mql5', 'btc', 'xauusd', 'btcusdt', 'eth', 'eurusd', 'gbpusd', '1h', '4h', '15m', '5m', '1m', 'd1', 'h1', 'h4', 'm15', 'm5', 'm1'}

def generate_conversation_title(prompt: str) -> str:
    """
    Generates a concise, subject-focused conversation title of 2 to 5 words.
    """
    if not prompt or not prompt.strip():
        return "Quant Research Session"
    
    cleaned = prompt.strip()
    # Normalize common timeframes (e.g., 1 h -> 1h, 15 m -> 15m)
    cleaned = re.sub(r'(\d+)\s*([hHmMdDsS])\b', r'\1\2', cleaned)
    # Remove punctuation
    cleaned = re.sub(r'[^\w\s]', ' ', cleaned)
    raw_words = cleaned.split()
    
    # 1. Prioritize quant domain words
    quant_tokens = []
    normal_tokens = []
    
    for w in raw_words:
        wl = w.lower()
        if wl in QUANT_KEYWORDS or re.match(r'^\d+[hmd]$', wl):
            quant_tokens.append(w)
        elif wl not in STOP_WORDS and len(wl) > 1 and not wl.isdigit():
            normal_tokens.append(w)
            
    # Combine quant tokens first, then fill from normal tokens
    selected = quant_tokens + [w for w in normal_tokens if w not in quant_tokens]
    
    # Format tokens
    formatted = []
    seen = set()
    for w in selected:
        wl = w.lower()
        if wl in seen:
            continue
        seen.add(wl)
        
        if wl in ACRONYMS or re.match(r'^\d+[hmd]$', wl):
            formatted.append(w.upper())
        elif wl in {'scalping', 'scalper'}:
            formatted.append('Scalper')
        elif wl in {'startegy', 'strategy'}:
            formatted.append('Strategy')
        else:
            formatted.append(w.capitalize())
            
        if len(formatted) == 5:
            break
            
    # Fallback if too few
    if len(formatted) < 2:
        for w in raw_words:
            wl = w.lower()
            if wl not in seen and len(wl) > 1:
                formatted.append(w.capitalize())
                seen.add(wl)
            if len(formatted) >= 2:
                break
                
    if len(formatted) < 2:
        formatted.append("Strategy")
        
    # Trim to max 5 words, min 2 words
    formatted = formatted[:5]
    return " ".join(formatted)

tests = [
    "i need to make new startegy based smc in 1 h",
    "Develop a scalping Expert Advisor for Gold (XAUUSD) on M1 timeframe",
    "Search the financial web for the best verified algorithmic trading strategies",
    "Propose a 100-run hyperparameter sweep across ATR multiplier and periods",
    "Transpile this strategy between Python Polars and MQL5 EA",
    "can you add trailing stop of 2.5 atr",
    "hello",
    "ok go",
    "backtest bollinger bands on btc 15m"
]

for t in tests:
    title = generate_conversation_title(t)
    print(f"'{t}' -> '{title}' ({len(title.split())} words)")
