# PROMPT MESTRE: RECRIAÇÃO DO GERADOR DE ARTIGOS CIENTÍFICOS

**Instrução para a IA (Copie e cole isso):**

Você deve atuar como um Engenheiro de Software Sênior e recriar uma aplicação web completa chamada "Gerador de Artigos Científicos". O coração deste sistema é um motor de iteração robusto que simula uma revisão por pares (peer review) acadêmica.

---

## 1. Visão Geral do Sistema

O aplicativo gera artigos científicos completos em LaTeX a partir de um tópico matemático.
**Diferencial:** Não é apenas "one-shot". Ele gera um rascunho e depois entra em um loop de **12 iterações de análise e melhoria**, avaliando o texto contra 28 critérios rigorosos.

**Stack Tecnológico:**
- Frontend: React 19, TypeScript, Vite.
- IA: Google Gemini (Modelos `gemini-2.5-flash` para análise e `gemini-2.5-pro` para escrita).
- Estilização: TailwindCSS.
- Compilação: Proxy para TeXLive.net.

---

## 2. O Motor de Iterações (Core Logic)

A IA deve implementar o seguinte fluxo de repetição (`for loop` de 1 a 12):

### Passo A: O Analista (The Critic)
A cada iteração, envie o código LaTeX atual para a IA (modelo rápido/flash) junto com a lista de **28 Tópicos de Análise** (veja seção 3).
A IA deve retornar um JSON estruturado contendo, para cada tópico:
1.  `score` (0.0 a 10.0).
2.  `improvement` (Instrução específica de correção).

### Passo B: O Filtro (The Gatekeeper)
O código deve verificar as notas.
- **Critério de Parada (Early Stop):** Se TODOS os scores forem >= 7.0, o loop deve ser interrompido imediatamente ("O artigo está pronto").
- Se houver scores baixos, filtre apenas os tópicos com `score < 8.5` para enviar para a etapa de melhoria.

### Passo C: O Editor (The Fixer)
Envie o código LaTeX e **apenas as críticas filtradas** para a IA (modelo pro).
Prompt: *"Você é um editor acadêmico. Corrija o artigo seguindo estritamente estas instruções de melhoria: [LISTA DE CRÍTICAS]. Mantenha o restante inalterado."*

---

## 3. Lista Crítica de Análise (Constantes)

O sistema **DEVE** utilizar exatamente esta lista de critérios para garantir a robustez da avaliação.

```typescript
export const ANALYSIS_TOPICS = [
    { num: 0, name: 'TOPIC FOCUS', desc: 'Mantém o foco central sem desviar.' },
    { num: 1, name: 'WRITING CLARITY', desc: 'Qualidade gramatical e legibilidade.' },
    { num: 2, name: 'METHODOLOGICAL RIGOR', desc: 'Validez científica da metodologia.' },
    { num: 3, name: 'ORIGINALITY', desc: 'Contribuição nova para a área.' },
    { num: 4, name: 'LITERATURE REVIEW', desc: 'Uso adequado de fontes e contexto.' },
    { num: 5, name: 'METHODOLOGY CLARITY', desc: 'Clareza e reprodutibilidade.' },
    { num: 6, name: 'RESULTS PRESENTATION', desc: 'Organização e objetividade dos resultados.' },
    { num: 7, name: 'DISCUSSION DEPTH', desc: 'Interpretação e link com teoria.' },
    { num: 8, name: 'ABSTRACT QUALITY', desc: 'Resumo conciso e completo.' },
    { num: 9, name: 'INTRODUCTION QUALITY', desc: 'Contexto e definição do problema.' },
    { num: 10, name: 'CONCLUSION QUALITY', desc: 'Resumo de achados e trabalhos futuros.' },
    { num: 11, name: 'ARGUMENTATION STRENGTH', desc: 'Lógica e evidências.' },
    { num: 12, name: 'COHERENCE AND FLOW', desc: 'Transições suaves entre seções.' },
    { num: 13, name: 'STRUCTURE', desc: 'Organização geral do LaTeX.' },
    { num: 14, name: 'REFERENCES', desc: 'Formatação e relevância.' },
    { num: 15, name: 'SCOPE AND BOUNDARIES', desc: 'Definição clara do escopo.' },
    { num: 16, name: 'SCIENTIFIC HONESTY', desc: 'Transparência e evitar plágio.' },
    { num: 17, name: 'TITLE-CONTENT ALIGNMENT', desc: 'Alinhamento entre título e conteúdo.' },
    { num: 18, name: 'STATEMENT OF LIMITATIONS', desc: 'Reconhecimento de limitações.' },
    { num: 20, name: 'PRACTICAL IMPLICATIONS', desc: 'Relevância prática.' },
    { num: 21, name: 'TERMINOLOGY', desc: 'Uso correto de termos técnicos.' },
    { num: 22, name: 'ETHICAL CONSIDERATIONS', desc: 'Considerações éticas.' },
    { num: 23, name: 'LATEX ACCURACY', desc: 'Compilabilidade técnica.' },
    { num: 24, name: 'STRATEGIC REFINEMENT', desc: 'Melhorias cirúrgicas sem quebrar o texto.' },
    { num: 25, name: 'THEORETICAL FOUNDATION', desc: 'Base teórica sólida.' },
    { num: 26, name: 'SCIENTIFIC CONTENT ACCURACY', desc: 'Precisão das informações científicas.' },
    { num: 27, name: 'DEPTH OF CRITICAL ANALYSIS', desc: 'Profundidade da análise crítica.' },
    { num: 28, name: 'PAGE COUNT', desc: 'Adesão ao tamanho solicitado.' }
];
```

---

## 4. Compilação Robusta e Auto-Fix

Como a IA gera LaTeX, erros de sintaxe são comuns. O sistema deve ter uma função `robustCompile(latexCode)` que:
1. Tenta compilar via API.
2. Se falhar (catch error), envia o erro e o código para a IA com o prompt: *"Fix the LaTeX syntax errors in this document based on this compilation log: [ERROR LOG]"*.
3. Tenta compilar novamente o código corrigido.

---

## 5. Prompt de Engenharia (Templates)

Utilize este template base para garantir a estrutura do documento:

```latex
\documentclass[12pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage{amsmath, amssymb, geometry}
% ... (outros pacotes padrão)
\begin{document}
% O conteúdo deve ser injetado aqui pela IA
\end{document}
```

**Regra de Ouro para Referências:** A IA deve ser estritamente proibida de usar `\bibitem` ou BibTeX complexo. As referências devem ser geradas como uma lista simples (`\section{Referências} \noindent [Ref 1] \par \noindent [Ref 2] \par`) para evitar erros de compilação cruzada.