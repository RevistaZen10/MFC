
// services/articleTemplate.ts

export const ARTICLE_TEMPLATE = `\\documentclass[12pt,a4paper]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{amsmath, amssymb, geometry, setspace, url, verbatim}
% Babel package will be added dynamically based on language
\\usepackage[unicode=true]{hyperref}

% Definição de comando para palavras-chave para facilitar extração
\\newcommand{\\keywords}[1]{\\vspace{0.5cm}\\noindent\\textbf{Keywords: } #1}

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
[INSERT NEW COMPLETE ABSTRACT HERE. This must be plain text without LaTeX commands.]
\\end{abstract}

\\keywords{[INSERT COMMA-SEPARATED KEYWORDS HERE]}

\\onehalfspacing

\\section{Introduction}
[INSERT NEW CONTENT FOR INTRODUCTION SECTION HERE. The content must be extensive and detailed to meet the required page count.]

\\section{Literature Review}
[INSERT NEW CONTENT FOR LITERATURE REVIEW SECTION HERE. The content must be extensive and detailed to meet the required page count.]

\\section{Methodology}
[INSERT NEW CONTENT FOR METHODOLOGY SECTION HERE. The content must be extensive and detailed to meet the required page count.]

\\section{Results}
[INSERT NEW CONTENT FOR RESULTS SECTION HERE. The content must be extensive and detailed to meet the required page count.]

\\section{Discussion}
[INSERT NEW CONTENT FOR DISCUSSION SECTION HERE. The content must be extensive and detailed to meet the required page count.]

\\section{Conclusion}
[INSERT NEW CONTENT FOR CONCLUSION SECTION HERE. The content must be extensive and detailed to meet the required page count.]

\\section{Referências}
% The AI service will dynamically replace the placeholder below with [INSERT REFERENCE COUNT]
% individual placeholders, one for each reference, separated by blank lines.
% Each reference must be a plain paragraph starting with \\noindent and ending with \\par.
% CRITICAL: Absolutely DO NOT use \\begin{thebibliography} or \\bibitem.
[INSERT NEW REFERENCE LIST HERE]

\\end{document}`;
