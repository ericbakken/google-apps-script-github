// File: deploy.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ------------------------------
// Configuration – update with your actual OpenAI API key.
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY_HERE'; // Replace with your actual key
// ------------------------------

const PROJECT_NAME = path.basename(process.cwd());

/**
 * Reads all project files from the current directory.
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
 * Retrieves the git diff (i.e. changes since the last commit).
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
 * Cleans the generated content by removing unwanted header lines.
 */
function cleanContent(content) {
  const lines = content.split('\n');
  const filteredLines = lines.filter(line => {
    if (line.trim().startsWith("```markdown")) return false;
    if (line.includes("{apps script ID")) return false;
    return true;
  });
  return filteredLines.join('\n');
}

/**
 * Generate a brief README update using GPT-4.
 * This is used when no code changes are detected; it summarizes that nothing changed.
 */
async function generateBriefReadme(codeFiles, diff) {
  let prompt = `
You are an expert technical writer. Generate a concise Markdown update for the Google Apps Script project "${PROJECT_NAME}".
This update should briefly state the overall project purpose, list the project files with a short description, and confirm that there are no meaningful code changes since the last update.
If any subtle documentation improvements are noted, mention them briefly.
Generate the complete brief README.
  `;
  
  const payload = {
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 600,
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
    console.error("Error generating brief README:", error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

/**
 * Generate the full README using GPT-4 when there are code changes.
 */
async function generateFullReadme(codeFiles, diff) {
  let prompt = `
You are an expert technical writer and software architect.
Generate a concise, beautifully formatted Markdown README for the Google Apps Script project named "${PROJECT_NAME}".
The README should include:
1. An overview of the project and its purpose.
2. A list of project files with a short summary for each.
3. A version control summary that describes the changes in the latest update, based on the following git diff:
${diff.trim() ? `\`\`\`\n${diff}\n\`\`\`` : "No changes detected."}
4. Basic usage instructions.
Generate the full README content in Markdown.
  `;
  
  const payload = {
    model: "gpt-4",
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
    console.error("Error generating full README:", error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

/**
 * Generate robust, detailed documentation for the docs folder using GPT-4.
 */
async function generateDocumentation(codeFiles, diff) {
  let prompt = `
You are an expert software architect and technical writer.
Create comprehensive, industry-standard documentation in Markdown for the Google Apps Script project "${PROJECT_NAME}".
The documentation should target skilled developers and include:
1. **Overview & Purpose:** A detailed explanation of the project's aims and functionality.
2. **Architecture:** Description of the project's structure, design rationale, and key components.
3. **File Summaries:** A detailed list of each project file along with an explanation of its purpose.
4. **Usage & Setup:** Step-by-step instructions to set up and use the project.
5. **Version Control Summary:** An explanation of the changes in the latest update based on the provided git diff, or a note that no changes were detected.
6. **Examples & Best Practices:** Provide examples, recommended configurations, and tips for efficient usage.
7. **Future Enhancements:** Outline potential improvements.
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
  
Now, generate the complete documentation as an index document in Markdown.
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
 * Main function: updates README.md concisely if no changes,
 * or fully if changes are detected, and updates detailed docs conditionally.
 */
async function deployProject() {
  console.log("Reading project files...");
  const codeFiles = getProjectFiles();
  
  console.log("Retrieving git diff for change summary...");
  const diff = getGitDiff();

  const repoEmpty = isRepoEmpty();
  
  let readmeContent;
  // Check if there are code changes.
  if (!repoEmpty && diff.trim() !== "") {
    console.log("Code changes detected. Generating full README.md...");
    readmeContent = await generateFullReadme(codeFiles, diff);
    
    console.log("Generating detailed documentation for docs/index.md...");
    const docsContent = await generateDocumentation(codeFiles, diff);
  
    const docsFolder = path.join(process.cwd(), "docs");
    if (!fs.existsSync(docsFolder)) {
      fs.mkdirSync(docsFolder);
    }
    fs.writeFileSync(path.join(docsFolder, "index.md"), docsContent, "utf8");
    console.log("Detailed documentation written to docs/index.md.");
  } else {
    console.log("No code changes detected. Generating a brief README.md update...");
    readmeContent = await generateBriefReadme(codeFiles, diff);
    console.log("No changes detected, so existing detailed documentation is kept as is.");
  }
  
  readmeContent = cleanContent(readmeContent);
  fs.writeFileSync("README.md", readmeContent, "utf8");
  console.log("README.md updated.");
  
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
