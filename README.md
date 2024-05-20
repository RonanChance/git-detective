# GitDetective

![image](./static/apple-touch-icon.png)

GitDetective scans public GitHub commits to retrieve usernames and emails associated with an account. 

GitDetective is for educational and research purposes only.

Use of this tool must be in accordance with GitHub's [terms of service](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service). GitDetective is not responsible for any misuse of the tool.

License: MIT

### Tech-Stack

- **Frontend Framework**: [SvelteKit](https://kit.svelte.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **CSS Framework**: [TailwindCSS](https://tailwindcss.com/) (+ [Shadcn-Svelte](https://www.shadcn-svelte.com/))
- **API**: [GitHub API](https://docs.github.com/en/rest)

## Process

1. Fetches a list of public repositories from the user profile using the GitHub API.

2. Gets the 200 most recent commits for each public repository using the GitHub API.

3. Displays the username(s) and email(s) if the author matches the provided account name.


## Privacy

All requests are client-side, meaning GitHub will know your IP address (and use of gitdetective.com). A VPN can cause requests to fail.

Searches are between you and GitHub. This website is open-source, MIT-licensed, and does not collect search data. 

## How to Host Locally

Clone this repository, navigate to the git-detective directory and install dependencies with `npm install`. 

Then start a development server:

```bash
npm run dev
```