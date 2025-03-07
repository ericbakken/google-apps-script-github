// File: deploy.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// ------------------------------
// Configuration – Replace with your own OpenAI API key.
const OPENAI_API_KEY = 'your_openai_api_key_here'; // Use a placeholder here.
/// ------------------------------

const PROJECT_NAME = path.basename(process.cwd());

/**
 * Reads all project files from the current directory.
 */
function getProjectFiles() {
  const validExts = ['.gs', '.js', '.html', '.json'];
  const codeFiles = {};

  fs.readdirSync(process.cwd()).forEach(file => {
    if (validExts.includes(path.extname(file))) {
      const content = fs.readFileSync(file, 'utf8');
      codeFiles[file] = content;
    }
  });
  return codeFiles;
}

/**
 * Retrieves the git diff (changes since last commit).
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
 * Clean the generated README content by removing unwanted header lines.
 * In this example, it removes any line starting with "```markdown" as well as lines containing "{apps script ID".
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
 * Generates a README.md using the OpenAI API.
 */
async function generateReadme(codeFiles, diff) {
  let prompt = `
You are an expert technical writer and software architect.
Generate a concise, beautifully formatted Markdown README for the Google Apps Script project named "${PROJECT_NAME}".
The README should include:

1. An overview and purpose of the project.
2. A list of each file with a brief summary of its functionality.
3. A "Version Control Summary" section that explains the changes in the latest update (based on the provided git diff). If no changes occurred, state that clearly.
4. Usage instructions, dependency notes, and maintenance recommendations.

Below are the details of the project files:
`;

  Object.entries(codeFiles).forEach(([filename, content]) => {
    prompt += `
### ${filename}
\`\`\`javascript
${content}
\`\`\`
Summary for ${filename}: Briefly describe what this file does.
`;
  });

  prompt += "\n---\n";
  prompt += "## Version Control Summary\n";
  prompt += diff.trim() 
    ? `Based on the following git diff, provide a concise summary of the changes:\n\n\`\`\`\n${diff}\n\`\`\`\n`
    : "No changes detected in this update.\n";
  prompt += "\nNow generate the complete README.md content in Markdown.";

  const payload = {
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 1500,
    temperature: 0.3
  };

  try {
    const response = await axios.post('https://api.openai.com/v1/chat/completions', payload, {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    return response.data.choices[0].message.content;
  } catch (error) {
    console.error("Error generating README with OpenAI:", error.response ? error.response.data : error.message);
    process.exit(1);
  }
}

/**
 * Main function: update README.md only if changes are detected.
 */
async function deployProject() {
  console.log("Reading project files...");
  const codeFiles = getProjectFiles();
  
  console.log("Retrieving git diff for change summary...");
  const diff = getGitDiff();
  
  if (diff.trim() === "") {
    console.log("No changes detected. Skipping README update and git push.");
    process.exit(0);
  }
  
  console.log("Generating README.md with OpenAI...");
  let readmeContent = await generateReadme(codeFiles, diff);
  // Clean unwanted header content.
  readmeContent = cleanReadme(readmeContent);
  
  fs.writeFileSync("README.md", readmeContent, "utf8");
  console.log("Updated README.md written.");
  
  try {
    execSync('git add .', { stdio: 'inherit' });
    execSync('git commit -m "Automated update: synchronized with GAS project and updated README.md"', { stdio: 'inherit' });
    execSync('git push', { stdio: 'inherit' });
    console.log("Changes pushed to GitHub successfully.");
  } catch (error) {
    console.error("Error during git operations:", error.message);
    process.exit(1);
  }
}

deployProject();
