// Agile jokes database and ticker manager
export const AGILE_JOKES = [
    "Why did the developer go broke? Because they used up all their cache.",
    "Why do programmers wear glasses? Because they can't C#.",
    "How many programmers does it take to change a light bulb? None, that's a hardware problem.",
    "Days without merge conflicts: 0.",
    "Estimates are like weather forecasts, except we're expected to change the weather.",
    "There are 10 types of people: those who understand binary, and those who don't.",
    "A SQL query walks into a bar, walks up to two tables and asks, 'Can I join you?'",
    "If at first you don't succeed, call it version 1.0.",
    "Agile is a process where you do twice the meetings in half the time.",
    "To understand recursion, you must first understand recursion.",
    "There's no place like 127.0.0.1.",
    "An optimist says the glass is half full. A pessimist says it's half empty. A programmer says it's twice as large as necessary.",
    "There are two ways to write error-free programs; only the third one works.",
    "A user interface is like a joke. If you have to explain it, it's not that good.",
    "Real programmers count from 0.",
    "Programming is 10% writing code and 90% figuring out why it doesn't work.",
    "An agile sprint is like a short race, except at the end, you immediately start another race.",
    "Why did the SCRUM master cross the road? To remove impediments on the other side.",
    "Hardware: the part of a computer you can kick. Software: the part you can only curse at.",
    "There are two hard things in computer science: cache invalidation, naming things, and off-by-one errors.",
    "A project manager is a person who thinks nine women can deliver a baby in one month.",
    "I've got a great joke about UDP, but I'm not sure if you'll get it.",
    "The best thing about boolean logic is that even if you're wrong, you're only off by a bit.",
    "Programming is like magic, except we wave a keyboard instead of a wand and the spells are full of bugs.",
    "What do developers do when they're cold? They stand in the corner. It's usually 90 degrees.",
    "Why did the database administrator leave the restaurant? Because of table locking.",
    "What is a programmer's favorite hangout spot? Foo Bar.",
    "A QA engineer walks into a bar. Orders a beer. Orders 0 beers. Orders 999999999 beers. Orders a lizard. Orders -1 beers. Orders a sfdeljkfhwue.",
    "How many QA engineers does it take to change a lightbulb? None, they just report that the room is dark.",
    "Why did the QA engineer cross the road? To test the parameters of the other side.",
    "Developer: 'It works on my machine!' QA: 'We are not shipping your machine.'",
    "99 little bugs in the code, 99 little bugs. Take one down, patch it around, 127 little bugs in the code.",
    "QA: 'I found a bug.' Developer: 'That's not a bug, it's an undocumented design feature.'",
    "Why did the testing engineer get fired? Because they kept breaking all the rules."
];

export class TriviaTicker {
    constructor(tickerElementId) {
        this.tickerElementId = tickerElementId;
        this.triviaInterval = null;
        this.currentTriviaIndex = Math.floor(Math.random() * AGILE_JOKES.length);
    }

    start() {
        if (this.triviaInterval) return;
        this.triviaInterval = setInterval(() => {
            this.currentTriviaIndex = (this.currentTriviaIndex + 1) % AGILE_JOKES.length;
            const tickerEl = document.getElementById(this.tickerElementId);
            if (tickerEl) {
                tickerEl.style.transition = 'opacity 0.3s ease';
                tickerEl.style.opacity = 0;
                setTimeout(() => {
                    tickerEl.textContent = AGILE_JOKES[this.currentTriviaIndex];
                    tickerEl.style.opacity = 0.85;
                }, 300);
            }
        }, 12000);
    }

    stop() {
        if (this.triviaInterval) {
            clearInterval(this.triviaInterval);
            this.triviaInterval = null;
        }
    }

    getCurrentJoke() {
        return AGILE_JOKES[this.currentTriviaIndex];
    }
}
