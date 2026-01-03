Advanced Scientific Paper Generator: An AI-Powered Workflow for Automated Research Publication
Creators
The system dynamically attributes papers to the author configured within the application's "Personal Data Settings".

Description
Project Summary for Zenodo
Abstract:

The Advanced Scientific Paper Generator is a sophisticated, AI-powered web application that fully automates the scientific publication workflow. Built on Google's powerful Gemini models (and optionally x.ai's Grok models), this tool seamlessly guides users from initial concept to a published paper with a registered DOI. The process starts by generating a compelling, high-impact research title from a selected discipline and topic. It then composes a complete, multi-page scientific paper in valid LaTeX, featuring an abstract, introduction, methodology, results, discussion, conclusion, and a bibliography grounded with real-world sources via Google Search and Semantic Scholar.

The application's core strength lies in its rigorous, multi-iteration quality assurance system. Each draft undergoes a comprehensive evaluation against 28 distinct academic and technical metrics. The AI then intelligently refines the LaTeX source code to correct flaws and elevate the paper's quality, ensuring high standards of academic integrity. Finally, the polished LaTeX is compiled into a PDF and can be published directly to Zenodo through its API, facilitating immediate DOI assignment and dissemination. Author details (name, affiliation, ORCID) are dynamically inserted from user configurations within the app, ensuring correct attribution.

Instructions for Reuse and Customization:

This application is openly available for adaptation by the research community. To configure the software for publishing under your name and control, please follow these steps:

1.  **Configure API Keys:** The application requires a Google Gemini API Key and a Zenodo Personal Access Token. If using Grok models, an x.ai API Key is also needed. All API keys can be securely stored within the application's settings (⚙️ icon).
2.  **Update Author Information:** To ensure correct attribution, configure your name, affiliation, and ORCID number using the dedicated "Personal Data Settings" button (👤 icon) in the application's header. This information will be used for generated papers and Zenodo publications.
3.  **Clear Publication History:** The "Artigos Publicados" (Step 4) section includes a button to "Limpar Histórico" (Clear History) which allows you to delete all stored publication records from your browser's local storage.

For detailed guidance on source code modification and deployment, please refer to the complete `README.md` file in the project repository.