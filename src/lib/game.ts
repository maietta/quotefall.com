
export interface Cell {
	charHash: string; // Simple hash of the UPPERCASE char
	isLetter: boolean;
	isPunctuation: boolean;
	isSpace: boolean;
	value: string; // User input
	row: number;
	col: number;
}

export interface ColumnLetter {
	char: string;
	isUsed: boolean;
}

export interface Puzzle {
	encodedQuote: string; // Base64 encoded
	encodedAuthor?: string; // Base64 encoded
	grid: Cell[][];
	columns: ColumnLetter[][];
	width: number;
	height: number;
}

// Simple non-cryptographic hash for character comparison
function hashChar(char: string): string {
    if (!char) return '';
    let hash = 0;
    for (let i = 0; i < char.length; i++) {
        hash = ((hash << 5) - hash) + char.charCodeAt(i);
        hash |= 0;
    }
    return hash.toString(36);
}

export function generatePuzzle(quote: string, author?: string, width = 15): Puzzle {
	const words = quote.toUpperCase().split(' ');
	const grid: Cell[][] = [];
	const tempChars: string[][] = [];
    
	let currentLine = 0;
	let currentPos = 0;
	
    const addCell = (char: string, isSpace = false) => {
        if (!grid[currentLine]) {
            grid[currentLine] = [];
            tempChars[currentLine] = [];
        }
        
        const isLetter = /[A-Z]/.test(char);
        const isPunctuation = !isLetter && !isSpace;
        
        grid[currentLine][currentPos] = {
            charHash: isLetter ? hashChar(char) : '',
            isLetter,
            isPunctuation,
            isSpace,
            value: isPunctuation ? char : '',
            row: currentLine,
            col: currentPos
        };
        tempChars[currentLine][currentPos] = char;
        currentPos++;
    };

	words.forEach((word, index) => {
		if (currentPos + word.length > width && currentPos !== 0) {
			while (currentPos < width) {
				addCell(' ', true);
			}
			currentLine++;
			currentPos = 0;
		}
		
		for (const char of word) {
			addCell(char);
		}
		
		if (index < words.length - 1 && currentPos < width) {
			addCell(' ', true);
		}
	});
	
	while (currentPos < width) {
		addCell(' ', true);
	}
	
	const height = currentLine + 1;
	const columns: ColumnLetter[][] = Array.from({ length: width }, () => []);
	
	for (let col = 0; col < width; col++) {
		for (let row = 0; row < height; row++) {
			const cell = grid[row][col];
            const char = tempChars[row][col];
			if (cell.isLetter) {
				columns[col].push({
					char: char,
					isUsed: false
				});
			}
		}
		columns[col].sort(() => Math.random() - 0.5);
	}
	
	return {
		encodedQuote: btoa(unescape(encodeURIComponent(quote))),
		encodedAuthor: author ? btoa(unescape(encodeURIComponent(author))) : undefined,
		grid,
		columns,
		width,
		height
	};
}

export function verifyChar(input: string, hash: string): boolean {
    if (!input || !hash) return false;
    return hashChar(input.toUpperCase()) === hash;
}

export function decode(str: string): string {
    try {
        return decodeURIComponent(escape(atob(str)));
    } catch (e) {
        return '';
    }
}
