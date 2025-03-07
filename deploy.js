// File: deploy.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ------------------------------
// Configuration – update these variables with your actual values.
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE';  // Replace with your OpenAI API key
// ------------------------------

const PROJECT_NAME = path.basename(process.cwd());

/**
 * Get all project files from the current directory.
 */
function getProjectFiles() {
  const validExts = ['.gs', '.js', '.html', '.json'];
  let codeFiles = {};
  fs.readdirSync(process.cwd()).forEach(file => {
    if (validExts.includes(path.extname(file))) {
      const content = fs.readFileSync(file, 'utf8');
      codeFiles[file] = content;
    }
  });
  return codeFiles;
}

/**
 * Retrieve the git diff (changes since the last commit).
 */
function getGitDiff() {
  try {
    const diff = execSync('git diff HEAD', { encoding: 'utf8' });
    return diff;
  } catch (error) {
    console.error("Error retrieving git diff:", error.message);
    return "";
  }
}

/**
 * Checks if the repository is empty (i.e. no previous commits).
 */
function isRepoEmpty() {
  try {
    execSync('git rev-parse HEAD', { encoding: 'utf8' });
    return false;
  } catch (error) {
    return true;
  }
}

/**
 * Cleans the generated README content by removing unwanted header lines.
 */
function cleanReadme(content) {
  const lines = content.split('\n');
  const filteredLines = lines.filter(line => {
    if (line.trim().startsWith("```markdown")) return false;
    if (line.includes("{apps script ID")) return false;
    return true;
  });
  return filteredLines.join('\n');
}

/**
 * Generate a brief README using OpenAI's GPT-4o. This README is meant to provide
 * a short overview of the project.
 */
async function generateReadme(codeFiles, diff) {
  let prompt = `
You are an expert technical writer and software architect.
Generate a concise, beautifully formatted Markdown README for a Google Apps Script project named "${PROJECT_NAME}".
The README should include:
1. A brief overview and purpose of the project.
2. A list of project files with a short summary for each.
3. A short version control summary based on the following git diff:
${diff.trim() ? `\`\`\`\n${diff}\n\`\`\`` : "No changes detected."}
4. Basic usage instructions.

Now, generate the complete README content in Markdown.
`;

  const payload = {
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1500,
    temperature: 0.3,
  };

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.choices<source_id data="0" title="Pasted_Text_1741320338444.txt" />.message.content;
  } catch (error) {
    console.error("Error generating README with OpenAI:", error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

/**
 * Generate robust documentation that goes beyond the README.
 * This should produce in-depth technical documentation suitable for skilled developers.
 */
async function generateDocumentation(codeFiles, diff) {
  let prompt = `
You are an expert software architect and technical writer. 
Create comprehensive, industry-standard documentation for a Google Apps Script project named "${PROJECT_NAME}". 

The documentation should be formatted in Markdown and intended for skilled developers. Please include:
1. **Overview & Purpose:** A detailed description of what the project does.
2. **Architecture:** An explanation of the project's structure, design decisions, and key components.
3. **File Summaries:** A list of each project file with a detailed summary of its functionality.
4. **Usage & Setup:** Instructions on how to set up and use the project, including prerequisites.
5. **Version Control Summary:** A explanation of recent changes based on the provided git diff below. If there are no changes, state that clearly.
6. **Examples & Best Practices:** Provide any usage examples, recommended configurations, or best practices.
7. **Future Enhancements:** Briefly outline potential future improvements to this project.

Below are the details of the project files and the git diff:

**Project Files:**
`;
  for (let [filename, content] of Object.entries(codeFiles)) {
    prompt += `
- **${filename}**: ${content.substring(0, 150).replace(/\n/g, ' ')}...  
`;
  }
  
  prompt += `
**Git Diff:**
${diff.trim() ? `\`\`\`\n${diff}\n\`\`\`` : "No changes detected."}

Now generate the full documentation as an index document in Markdown.
`;

  const payload = {
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 2500,
    temperature: 0.3,
  };

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      payload,
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data.choices<source_id data="0" title="Pasted_Text_1741320338444.txt" />.message.content;
  } catch (error) {
    console.error("Error generating documentation with OpenAI:", error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

/**
 * Main function: update README.md and robust documentation in the docs folder.
 * Push if changes are detected or the repo is empty.
 */
async function deployProject() {
  console.log("Reading project files...");
  const codeFiles = getProjectFiles();
  
  console.log("Retrieving git diff for change summary...");
  const diff = getGitDiff();

  const repoEmpty = isRepoEmpty();
  if (!repoEmpty && diff.trim() === "") {
    console.log("No changes detected. Skipping documentation update and git push.");
    process.exit(0);
  }
  
  console.log("Generating README.md with OpenAI...");
  let readmeContent = await generateReadme(codeFiles, diff);
  readmeContent = cleanReadme(readmeContent);
  fs.writeFileSync("README.md", readmeContent, "utf8");
  console.log("Updated README.md written at repository root.");
  
  // Generate robust documentation in the docs folder.
  console.log("Generating detailed documentation with OpenAI...");
  let docsContent = await generateDocumentation(codeFiles, diff);
  
  // Ensure the docs folder exists.
  const docsFolder = path.join(process.cwd(), "docs");
  if (!fs.existsSync(docsFolder)) {
    fs.mkdirSync(docsFolder);
  }
  
  fs.writeFileSync(path.join(docsFolder, "index.md"), docsContent, "utf8");
  console.log("Detailed documentation written to docs/index.md.");
  
  // Stage changes, commit, and push.
  try {
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "Automated update: synchronized with GAS project and updated documentation"', { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    console.log("Changes pushed to GitHub successfully.");
  } catch (error) {
    console.error("Error during git operations:", error.message);
    process.exit(1);
  }
}

deployProject();
