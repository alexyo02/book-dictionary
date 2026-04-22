export interface WordDefinition {
  word: string;
  definition: string;
}

async function fetchWikipediaFallback(word: string): Promise<WordDefinition | null> {
  try {
    const url = `https://it.wikipedia.org/w/api.php?action=query&prop=extracts&exsentences=4&titles=${encodeURIComponent(word)}&explaintext=1&format=json&origin=*`;
    const response = await fetch(url);
    const data = await response.json();
    const pages = data.query?.pages;
    if (!pages) return null;
    const pageId = Object.keys(pages)[0];
    if (pageId === "-1") return null;
    const extract = pages[pageId].extract as string;
    if (!extract || extract.trim() === '') return null;

    let cleaned = extract.replace(/\n==.*==\n/g, '\n').replace(/\n+/g, '\n').trim();

    return {
      word: word,
      definition: `\n[ WIKIPEDIA (ENCICLOPEDIA) ]\n${cleaned}\n\nTermine assente dal dizionario, ma individuato come concetto enciclopedico.`
    };
  } catch (err) {
    return null;
  }
}

const SECTION_PRIORITY: Record<string, number> = {
  'sostantivo': 1,
  'verbo': 2,
  'aggettivo': 3,
  'avverbio': 4,
  'pronome': 5,
  'preposizione': 6,
  'congiunzione': 7,
  'articolo': 8,
  'interiezione': 9,
  'prefisso': 10,
  'suffisso': 11,
  'sinonimi': 12,
  'contrari': 13
};

interface ParsedSection {
  name: string;
  lines: string[];
}

export async function fetchDefinition(word: string): Promise<WordDefinition | null> {
  try {
    const url = `https://it.wiktionary.org/w/api.php?action=query&prop=extracts&titles=${encodeURIComponent(word.toLowerCase())}&explaintext=1&format=json&origin=*`;

    const response = await fetch(url);
    const data = await response.json();

    const pages = data.query?.pages;
    if (!pages) return await fetchWikipediaFallback(word);

    const pageId = Object.keys(pages)[0];
    if (pageId === "-1") {
       return await fetchWikipediaFallback(word);
    }

    const extract = pages[pageId].extract as string;
    if (!extract) return await fetchWikipediaFallback(word);

    let lines = extract.split('\n');
    let isItalian = false;
    let skipSection = false;

    const validSections = Object.keys(SECTION_PRIORITY);

    let sections: ParsedSection[] = [];
    let currentSection: ParsedSection | null = null;
    let currentSectionContentLinesCount = 0;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];

      if (line.includes('== Italiano ==')) {
        isItalian = true;
        continue;
      }

      if (line.startsWith('== ') && !line.includes('== Italiano ==')) {
         if (isItalian) break;
      }

      if (!isItalian) continue;

      if (line.startsWith('===')) {
        if (currentSection && currentSectionContentLinesCount === 1) {
           currentSection.lines.push("Definizione non ancora disponibile su Wiktionary.");
        }

        let sectionNameRaw = line.replace(/=/g, '').trim().toLowerCase();
        let matchedSection = validSections.find(vs => sectionNameRaw.includes(vs));

        if (matchedSection) {
           skipSection = false;
           currentSectionContentLinesCount = 0;
           currentSection = { name: matchedSection, lines: [] };
           sections.push(currentSection);
           continue;
        } else {
           skipSection = true;
           currentSection = null;
           continue;
        }
      }

      if (!skipSection && currentSection) {
        let cleanedLine = line.trim();
        cleanedLine = cleanedLine.replace(/\(\s*approfondimento\s*\)/gi, '');
        cleanedLine = cleanedLine.replace(/definizione mancante;\s*se vuoi,\s*aggiungila tu/gi, '');
        cleanedLine = cleanedLine.replace(/definizione mancante/gi, '');
        cleanedLine = cleanedLine.trim();

        if (cleanedLine && cleanedLine !== '-' && cleanedLine !== ';') {
           currentSection.lines.push(cleanedLine);
           currentSectionContentLinesCount++;
        }
      }
    }

    if (currentSection && currentSectionContentLinesCount === 1) {
      currentSection.lines.push("Definizione non ancora disponibile su Wiktionary.");
    }

    // Heuristic Sort: prioritize based on predefined list
    sections.sort((a, b) => {
       const priorityA = SECTION_PRIORITY[a.name] || 99;
       const priorityB = SECTION_PRIORITY[b.name] || 99;
       return priorityA - priorityB;
    });

    let keepLines: string[] = [];
    for (const sec of sections) {
        if (sec.lines.length > 0) {
            keepLines.push(`\n[ ${sec.name.toUpperCase()} ]`);
            keepLines.push(...sec.lines);
        }
    }

    let finalDefinition = keepLines.join('\n').trim();

    if (!finalDefinition) {
       const fallback = await fetchWikipediaFallback(word);
       if (fallback) return fallback;

       const rawLines = extract.split('\n').filter(l => l.trim() !== '' && !l.startsWith('=='));
       finalDefinition = rawLines.slice(0, 4).join('\n');
    }

    if (!finalDefinition) {
       return await fetchWikipediaFallback(word);
    }

    return {
      word: word,
      definition: finalDefinition
    };

  } catch (error) {
    console.error("Error fetching definition:", error);
    throw error;
  }
}
