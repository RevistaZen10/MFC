
// services/articleTemplate.ts

export const ARTICLE_TEMPLATE = `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath, amssymb, geometry, setspace, url}
% Babel package will be added dynamically based on language
\\usepackage[unicode=true]{hyperref}

% Definição robusta de palavras-chave (keywords)
% O comando aceita 1 argumento [1]
\\providecommand{\\keywords}[1]{\\par\\addvspace\\baselineskip\\noindent\\textbf{Keywords:}\\enspace#1}

\\hypersetup{
  pdftitle={[INSERT NEW TITLE HERE]},
  pdfauthor={__PDF_AUTHOR_NAMES_PLACEHOLDER__},
  colorlinks=true,
  linkcolor=blue,
  citecolor=blue,
  urlcolor=blue
}

\\title{[INSERT NEW TITLE HERE]}

\\author{
  __ALL_AUTHORS_LATEX_BLOCK__
}

\\date{}

\\begin{document}

\\maketitle

\\begin{abstract}
[INSERT NEW COMPLETE ABSTRACT HERE]
\\end{abstract}

\\keywords{[INSERT COMMA-SEPARATED KEYWORDS HERE]}

\\onehalfspacing

\\section{Introduction}
[INSERT NEW CONTENT FOR INTRODUCTION SECTION HERE]

\\section{Literature Review}
[INSERT NEW CONTENT FOR LITERATURE REVIEW SECTION HERE]

\\section{Methodology}
[INSERT NEW CONTENT FOR METHODOLOGY SECTION HERE]

\\section{Results}
[INSERT NEW CONTENT FOR RESULTS SECTION HERE]

\\section{Discussion}
[INSERT NEW CONTENT FOR DISCUSSION SECTION HERE]

\\section{Conclusion}
[INSERT NEW CONTENT FOR CONCLUSION SECTION HERE]

\\section{Referências}
[INSERT NEW REFERENCE LIST HERE]

\\end{document}`;
