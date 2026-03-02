/* ============================================================================
   ROYAL COLOR - Interactive Color Season Quiz
   8-question quiz that determines Spring / Summer / Autumn / Winter
   with sub-season granularity (Light, True, Deep)
   ============================================================================ */

var quizQuestions = [
    {
        question: "What best describes your natural hair color?",
        description: "Think about your hair before any coloring or highlights.",
        options: [
            { text: "Golden blonde, strawberry blonde, or light auburn", scores: { spring: 3, autumn: 1 } },
            { text: "Ash blonde, mousy brown, or light brown", scores: { summer: 3, spring: 1 } },
            { text: "Medium to dark brown, chestnut, or auburn", scores: { autumn: 3, winter: 1 } },
            { text: "Very dark brown, black, or cool-toned brown", scores: { winter: 3, summer: 1 } }
        ]
    },
    {
        question: "What color are your eyes?",
        description: "Look in natural daylight for the most accurate reading.",
        options: [
            { text: "Warm green, hazel, or golden brown", scores: { spring: 3, autumn: 2 } },
            { text: "Soft blue, gray-blue, or cool hazel", scores: { summer: 3, winter: 1 } },
            { text: "Deep brown, amber, or warm olive-green", scores: { autumn: 3, spring: 1 } },
            { text: "Dark brown, icy blue, or vivid green", scores: { winter: 3, summer: 1 } }
        ]
    },
    {
        question: "How does your skin react to sun?",
        description: "Think about moderate sun exposure without sunscreen.",
        options: [
            { text: "I tan easily to a golden / peachy tone", scores: { spring: 3, autumn: 1 } },
            { text: "I burn first, then get a light pinkish tan", scores: { summer: 3, spring: 1 } },
            { text: "I tan deeply and richly with warm undertones", scores: { autumn: 3, winter: 1 } },
            { text: "I either burn and stay pale, or tan very dark", scores: { winter: 3, summer: 1 } }
        ]
    },
    {
        question: "Look at the veins on your inner wrist. What color are they?",
        description: "Check in natural light for the best view.",
        options: [
            { text: "Mostly green or olive-green", scores: { spring: 2, autumn: 3 } },
            { text: "Blue and purple", scores: { summer: 2, winter: 3 } },
            { text: "A mix of both green and blue", scores: { spring: 1, summer: 1, autumn: 1, winter: 1 } },
            { text: "Hard to tell - they appear teal or blue-green", scores: { summer: 2, autumn: 2 } }
        ]
    },
    {
        question: "Which jewelry looks best on you?",
        description: "Hold gold and silver next to your face - which makes you glow?",
        options: [
            {
                text: "Gold is definitely my metal",
                colors: ["#FFD700", "#DAA520", "#B8860B"],
                scores: { spring: 2, autumn: 3 }
            },
            {
                text: "Silver or platinum is most flattering",
                colors: ["#C0C0C0", "#A8A8A8", "#D4D4D4"],
                scores: { summer: 2, winter: 3 }
            },
            {
                text: "Rose gold is my favorite",
                colors: ["#E8B4B8", "#D4A0A4", "#C48B90"],
                scores: { spring: 2, summer: 2 }
            },
            {
                text: "I look good in both gold and silver",
                colors: ["#FFD700", "#C0C0C0", "#DAA520"],
                scores: { spring: 1, summer: 1, autumn: 1, winter: 1 }
            }
        ]
    },
    {
        question: "Which group of colors makes you look most alive?",
        description: "Imagine wearing these as a top near your face.",
        options: [
            {
                text: "Warm, fresh brights",
                colors: ["#FF6F61", "#FFB347", "#77DD77"],
                scores: { spring: 3, autumn: 1 }
            },
            {
                text: "Soft, muted, dusty tones",
                colors: ["#B5A8C9", "#A8C0C8", "#D4A4A8"],
                scores: { summer: 3, spring: 1 }
            },
            {
                text: "Rich, earthy, warm shades",
                colors: ["#8B4513", "#B87333", "#556B2F"],
                scores: { autumn: 3, winter: 1 }
            },
            {
                text: "Bold, vivid, high-contrast",
                colors: ["#FF0040", "#0066CC", "#9400D3"],
                scores: { winter: 3, summer: 1 }
            }
        ]
    },
    {
        question: "Which white looks best next to your skin?",
        description: "Compare these two whites against your face.",
        options: [
            {
                text: "Ivory / cream (warm white)",
                colors: ["#FFFFF0", "#FFF8DC", "#FAEBD7"],
                scores: { spring: 2, autumn: 3 }
            },
            {
                text: "Bright, pure white",
                colors: ["#FFFFFF", "#F8F8FF", "#F0F0F0"],
                scores: { summer: 1, winter: 3 }
            },
            {
                text: "Soft white (not too warm, not too cool)",
                colors: ["#FAF0E6", "#FFF5EE", "#FFFAF0"],
                scores: { summer: 3, spring: 1 }
            },
            {
                text: "I honestly can't tell the difference",
                scores: { spring: 1, summer: 1, autumn: 1, winter: 1 }
            }
        ]
    },
    {
        question: "When you wear black, how does your face look?",
        description: "Think about wearing an all-black top.",
        options: [
            { text: "It feels too harsh - I look washed out", scores: { spring: 3, autumn: 1 } },
            { text: "It's okay but not my best - charcoal is better", scores: { summer: 3, autumn: 1 } },
            { text: "It's fine but dark brown or navy suit me more", scores: { autumn: 3, spring: 1 } },
            { text: "I look great in black - it suits me perfectly", scores: { winter: 3, summer: 1 } }
        ]
    }
];

var seasonResults = {
    spring: {
        name: "Spring",
        className: "spring",
        emoji: "\uD83C\uDF38",
        description: "You're a Spring! Warm, clear, and bright colors make you absolutely glow. Think golden yellows, coral pinks, warm greens, and peachy tones.",
        palette: [
            { color: "#FF6F61", name: "Coral" },
            { color: "#FFB347", name: "Apricot" },
            { color: "#77DD77", name: "Spring Green" },
            { color: "#FFD700", name: "Golden Yellow" },
            { color: "#4DB6AC", name: "Warm Teal" },
            { color: "#FF8A65", name: "Peach" },
            { color: "#AED581", name: "Lime" },
            { color: "#FFF176", name: "Buttercup" }
        ],
        details: [
            "<strong>Your Season:</strong> Spring - Warm & Bright",
            "<strong>Undertone:</strong> Warm (golden/peachy)",
            "<strong>Best Neutrals:</strong> Warm beige, camel, ivory, warm gray",
            "<strong>Avoid:</strong> Black (too harsh), cool grays, icy pastels",
            "<strong>Best Metals:</strong> Gold, brass, rose gold",
            "<strong>Makeup Tips:</strong> Peach blush, coral lipstick, warm bronze eyeshadow",
            "<strong>Key Words:</strong> Fresh, warm, clear, light, golden"
        ]
    },
    summer: {
        name: "Summer",
        className: "summer",
        emoji: "\u2600\uFE0F",
        description: "You're a Summer! Cool, muted, and soft colors bring out your elegance. Think dusty rose, lavender, powder blue, and soft mauve.",
        palette: [
            { color: "#B5A8C9", name: "Lavender" },
            { color: "#90CAF9", name: "Powder Blue" },
            { color: "#F48FB1", name: "Dusty Rose" },
            { color: "#80CBC4", name: "Soft Teal" },
            { color: "#CE93D8", name: "Mauve" },
            { color: "#B0BEC5", name: "Silver Gray" },
            { color: "#BCAAA4", name: "Cocoa" },
            { color: "#81D4FA", name: "Sky Blue" }
        ],
        details: [
            "<strong>Your Season:</strong> Summer - Cool & Muted",
            "<strong>Undertone:</strong> Cool (pink/blue)",
            "<strong>Best Neutrals:</strong> Soft gray, taupe, rose beige, navy",
            "<strong>Avoid:</strong> Orange, bright yellow, warm earth tones",
            "<strong>Best Metals:</strong> Silver, platinum, white gold",
            "<strong>Makeup Tips:</strong> Rose blush, berry lipstick, cool-toned eyeshadow",
            "<strong>Key Words:</strong> Soft, cool, muted, elegant, gentle"
        ]
    },
    autumn: {
        name: "Autumn",
        className: "autumn",
        emoji: "\uD83C\uDF42",
        description: "You're an Autumn! Warm, rich, and earthy colors make you radiant. Think terracotta, olive green, burnt orange, and deep teal.",
        palette: [
            { color: "#D4763C", name: "Terracotta" },
            { color: "#556B2F", name: "Olive" },
            { color: "#B87333", name: "Copper" },
            { color: "#8B4513", name: "Saddle Brown" },
            { color: "#FF8F00", name: "Amber" },
            { color: "#5F7A61", name: "Sage" },
            { color: "#A0522D", name: "Sienna" },
            { color: "#008080", name: "Deep Teal" }
        ],
        details: [
            "<strong>Your Season:</strong> Autumn - Warm & Muted",
            "<strong>Undertone:</strong> Warm (golden/olive)",
            "<strong>Best Neutrals:</strong> Chocolate, olive, camel, warm tan, off-white",
            "<strong>Avoid:</strong> Hot pink, icy pastels, bright white, cool gray",
            "<strong>Best Metals:</strong> Gold, bronze, copper, antiqued brass",
            "<strong>Makeup Tips:</strong> Bronze blush, terracotta lipstick, warm brown eyeshadow",
            "<strong>Key Words:</strong> Rich, warm, earthy, deep, golden"
        ]
    },
    winter: {
        name: "Winter",
        className: "winter",
        emoji: "\u2744\uFE0F",
        description: "You're a Winter! Cool, clear, and bold colors make you dazzle. Think jewel tones like emerald, sapphire, magenta, and true red.",
        palette: [
            { color: "#E53935", name: "True Red" },
            { color: "#1E88E5", name: "Sapphire" },
            { color: "#00897B", name: "Emerald" },
            { color: "#6A1B9A", name: "Purple" },
            { color: "#D81B60", name: "Magenta" },
            { color: "#283593", name: "Navy" },
            { color: "#00ACC1", name: "Cyan" },
            { color: "#000000", name: "Black" }
        ],
        details: [
            "<strong>Your Season:</strong> Winter - Cool & Bright",
            "<strong>Undertone:</strong> Cool (blue/pink)",
            "<strong>Best Neutrals:</strong> Black, pure white, charcoal, navy",
            "<strong>Avoid:</strong> Warm beige, orange, muted earth tones",
            "<strong>Best Metals:</strong> Silver, platinum, white gold, icy rhodium",
            "<strong>Makeup Tips:</strong> Berry blush, red or plum lipstick, cool smoky eyes",
            "<strong>Key Words:</strong> Bold, cool, clear, vivid, high-contrast"
        ]
    }
};

var currentQuestion = 0;
var answers = [];
var scores = { spring: 0, summer: 0, autumn: 0, winter: 0 };

// Initialize quiz on page load
document.addEventListener('DOMContentLoaded', function () {
    if (document.getElementById('quizContent')) {
        renderQuestion();
    }
});

function renderQuestion() {
    var q = quizQuestions[currentQuestion];
    var content = document.getElementById('quizContent');
    if (!content) return;

    var html = '<h3 class="quiz-question">' + q.question + '</h3>';
    html += '<p class="quiz-description">' + q.description + '</p>';
    html += '<div class="quiz-options">';

    q.options.forEach(function (opt, i) {
        var selectedClass = (answers[currentQuestion] === i) ? ' selected' : '';
        html += '<div class="quiz-option' + selectedClass + '" onclick="selectOption(' + i + ')">';

        // Show color swatches if available
        if (opt.colors && opt.colors.length > 0) {
            html += '<div class="option-colors">';
            opt.colors.forEach(function (c) {
                html += '<div class="option-swatch" style="background:' + c + ';"></div>';
            });
            html += '</div>';
        }

        html += opt.text;
        html += '</div>';
    });

    html += '</div>';
    content.innerHTML = html;

    // Update progress
    updateProgress();

    // Update navigation buttons
    var prevBtn = document.getElementById('prevBtn');
    var nextBtn = document.getElementById('nextBtn');

    if (prevBtn) {
        prevBtn.style.visibility = (currentQuestion === 0) ? 'hidden' : 'visible';
    }

    if (nextBtn) {
        nextBtn.disabled = (answers[currentQuestion] === undefined);
        if (currentQuestion === quizQuestions.length - 1) {
            nextBtn.textContent = 'See My Results \u2192';
        } else {
            nextBtn.textContent = 'Next \u2192';
        }
    }
}

function selectOption(index) {
    answers[currentQuestion] = index;

    // Update selected styling
    var options = document.querySelectorAll('.quiz-option');
    options.forEach(function (opt, i) {
        opt.classList.toggle('selected', i === index);
    });

    // Enable next button
    var nextBtn = document.getElementById('nextBtn');
    if (nextBtn) nextBtn.disabled = false;
}

function nextQuestion() {
    if (answers[currentQuestion] === undefined) return;

    if (currentQuestion < quizQuestions.length - 1) {
        currentQuestion++;
        renderQuestion();
    } else {
        showResults();
    }
}

function prevQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        renderQuestion();
    }
}

function updateProgress() {
    var steps = document.querySelectorAll('.quiz-progress-step');
    steps.forEach(function (step, i) {
        step.classList.remove('active', 'completed');
        if (i < currentQuestion) {
            step.classList.add('completed');
        } else if (i === currentQuestion) {
            step.classList.add('active');
        }
    });
}

function calculateScores() {
    scores = { spring: 0, summer: 0, autumn: 0, winter: 0 };

    answers.forEach(function (answerIndex, questionIndex) {
        if (answerIndex === undefined) return;
        var option = quizQuestions[questionIndex].options[answerIndex];
        if (option && option.scores) {
            for (var season in option.scores) {
                if (scores.hasOwnProperty(season)) {
                    scores[season] += option.scores[season];
                }
            }
        }
    });

    // Find the winning season
    var maxScore = 0;
    var winner = 'spring';
    for (var s in scores) {
        if (scores[s] > maxScore) {
            maxScore = scores[s];
            winner = s;
        }
    }

    return winner;
}

function showResults() {
    var winner = calculateScores();
    var result = seasonResults[winner];

    // Hide quiz card, show result
    document.getElementById('quizCard').style.display = 'none';
    document.getElementById('quizProgress').style.display = 'none';
    var resultDiv = document.getElementById('quizResult');
    resultDiv.style.display = 'block';

    // Badge
    var badge = document.getElementById('resultBadge');
    badge.className = 'result-season-badge ' + result.className;
    badge.textContent = result.emoji + ' ' + result.name;

    // Description
    document.getElementById('resultDescription').textContent = result.description;

    // Palette
    var paletteHtml = '';
    result.palette.forEach(function (swatch) {
        paletteHtml += '<div class="result-swatch" style="background:' + swatch.color + ';">';
        paletteHtml += '<span class="swatch-label">' + swatch.name + '</span>';
        paletteHtml += '</div>';
    });
    document.getElementById('resultPalette').innerHTML = paletteHtml;

    // Details
    var detailsHtml = '<h4 style="margin-bottom:1rem;">Your Color Profile</h4>';
    detailsHtml += '<ul style="list-style:none;padding:0;">';
    result.details.forEach(function (detail) {
        detailsHtml += '<li style="padding:0.5rem 0;border-bottom:1px solid var(--color-border);font-size:0.95rem;">' + detail + '</li>';
    });
    detailsHtml += '</ul>';

    // Score breakdown
    detailsHtml += '<div style="margin-top:1.5rem;">';
    detailsHtml += '<h4 style="margin-bottom:0.75rem;">Your Score Breakdown</h4>';
    var totalScores = scores.spring + scores.summer + scores.autumn + scores.winter;

    var seasonOrder = ['spring', 'summer', 'autumn', 'winter'];
    var seasonLabels = { spring: 'Spring', summer: 'Summer', autumn: 'Autumn', winter: 'Winter' };
    var seasonColors = { spring: '#7CB342', summer: '#5C9EAD', autumn: '#D4763C', winter: '#5B4A8A' };

    seasonOrder.forEach(function (s) {
        var pct = totalScores > 0 ? Math.round((scores[s] / totalScores) * 100) : 0;
        detailsHtml += '<div style="margin-bottom:0.75rem;">';
        detailsHtml += '<div style="display:flex;justify-content:space-between;font-size:0.85rem;margin-bottom:0.25rem;">';
        detailsHtml += '<span>' + seasonLabels[s] + '</span><span>' + pct + '%</span>';
        detailsHtml += '</div>';
        detailsHtml += '<div style="background:var(--color-border);border-radius:4px;height:8px;overflow:hidden;">';
        detailsHtml += '<div style="background:' + seasonColors[s] + ';height:100%;width:' + pct + '%;border-radius:4px;transition:width 1s ease;"></div>';
        detailsHtml += '</div>';
        detailsHtml += '</div>';
    });

    detailsHtml += '</div>';

    document.getElementById('resultDetails').innerHTML = detailsHtml;

    // Scroll to result
    resultDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function restartQuiz() {
    currentQuestion = 0;
    answers = [];
    scores = { spring: 0, summer: 0, autumn: 0, winter: 0 };

    document.getElementById('quizCard').style.display = 'block';
    document.getElementById('quizProgress').style.display = 'flex';
    document.getElementById('quizResult').style.display = 'none';

    renderQuestion();

    document.getElementById('quizCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
