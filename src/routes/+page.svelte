<script lang="ts">
    import * as Accordion from "$lib/components/ui/accordion";
    import { Input } from "$lib/components/ui/input";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Octokit } from 'octokit';
    import { tsCode } from "$lib/components/codesnippet/codesnippet.js";
    import * as Popover from "$lib/components/ui/popover";
    import * as AlertDialog from "$lib/components/ui/alert-dialog";
    
    const octokit = new Octokit();
    let processing: boolean = false;
    let isToastVisible: boolean = false;
    let isDone: boolean = false;
    let abortController: AbortController | null = null;

    let username: string = "";
    let usernameMapping: { [key: string]: string } = {};
    let emailMapping: { [key: string]: string } = {};
    let unknownMapping: { [key: string]: string } = {};
    
    let repoListLength: number = 0;
    let repoCounter: number = 0;
    let commitCounter: number = 0;

    async function runSearch(): Promise<void> {
        if (username === "") {
            isToastVisible = true;
            return;
        }

        if (processing) return;
        clearVariables();
        processing = true;
        abortController = new AbortController();

        try {
            const repositories = await fetchRepositories();
            await processRepositories(repositories);
        } catch (error) {
            handleSearchError(error);
        } finally {
            processing = false;
            abortController = null;
            if (repoListLength === repoCounter) isDone = true;
        } 
    }

    async function fetchRepositories(): Promise<string[]> {
        if (abortController === null) throw new Error("AbortController not initialized");
        const { data: repos } = await octokit.rest.repos.listForUser({ username, signal: abortController.signal });
        repoListLength = repos.length;
        return repos.map(repo => repo['commits_url'].slice(0, -6));
    }

    async function processRepositories(repositories: string[]): Promise<void> {
        if (abortController === null) throw new Error("AbortController not initialized");

        for (const repo of repositories) {

            if (abortController.signal.aborted) throw new Error('AbortError');

            try {
                const response = await fetch(repo, { method: 'GET', headers: { 'Content-Type': 'application/json' }, signal: abortController.signal});
                if (!response.ok) throw new Error(`Error fetching repo: ${response.statusText}`);
                const data = await response.json();

                processCommits(data, repo);           
                repoCounter += 1;

                await new Promise((resolve) => setTimeout(resolve, 1500));

                if (abortController.signal.aborted) throw new Error('AbortError');
            } catch (error) {
                handleRepoProcessingError(error);
            }
        }
    }

    function processCommits(commits: any[], repo: string): void {
        for (const commit of commits) {
            if (abortController && abortController.signal.aborted) throw new Error('AbortError');

            const { name, email } = commit.commit.author;
            const login = commit.author?.login || null;

            if (!login) {
                unknownMapping[name] = repo;
                unknownMapping[email] = repo;
            } else if (login === username) {
                if (!(name in usernameMapping)) usernameMapping[name] = repo;
                if (!(email in emailMapping)) emailMapping[email] = repo;
            }

            commitCounter += 1;
        }
    }

    function clearVariables(): void {
        usernameMapping = {};
        emailMapping = {};
        unknownMapping = {};
        commitCounter = 0;
        repoCounter = 0;
        repoListLength = 0;
        isDone = false;
    }

    function handleCancel(): void {
        if (abortController) {
            abortController.abort();
            processing = false;
        }
    }

    function handleSearchError(error: any): void {
        if (error instanceof Error && error.message === 'AbortError') {
            console.log("Search aborted");
        } else {
            console.error("Error during search:", error);
            isToastVisible = true;
        }
    }

    function handleRepoProcessingError(error: any): void {
    if (error instanceof Error && error.message === 'AbortError') {
        throw new Error('AbortError');
    } else {
        console.error('Error processing repository:', error);
        isToastVisible = true;
    }
}

</script>
    
<div class="text-[var(--black)]">
    <div class="text-center mt-5 ">
        <AlertDialog.Root open={isToastVisible}>
            <AlertDialog.Content>
              <AlertDialog.Header>
                <AlertDialog.Title>Oops!</AlertDialog.Title>
                <AlertDialog.Description>
                  Something went wrong. Check the account name and try again.
                </AlertDialog.Description>
              </AlertDialog.Header>
              <AlertDialog.Footer>
                <AlertDialog.Action on:click={() => isToastVisible = false}>Continue</AlertDialog.Action>
              </AlertDialog.Footer>
            </AlertDialog.Content>
          </AlertDialog.Root>
    </div>
    <div class="flex flex-col items-center">
        <h1 class="text-center mt-6 pt-5 text-4xl font-extrabold leading-none tracking-tight text-[var(--black)] md:text-5xl lg:text-6xl dark:text-white">GitDetective</h1>
        <p class="italic text-center pt-3 pb-6 px-6 mb-6 font-normal text-gray-600 text-xl lg:text-2xl xl:px-48 dark:text-gray-400">A GitHub Alias Detection Program</p>
        <form class="flex w-full max-w-md pb-6 mb-2 items-center space-x-2 px-6" on:submit|preventDefault={processing ? handleCancel : runSearch} data-lpignore="true" autocomplete="off">
            <Input type="text" placeholder="Username" bind:value={username} autocomplete="off" data-lpignore="true" data-form-type="other"/>
            <Button type="submit" class={processing ? 'bg-gray-500' : 'bg-[var(--black)]'}>
                {processing ? 'Cancel' : 'Search'}
            </Button>
        </form>
    </div>
    <div class="flex flex-col items-start px-8 gap-8 lg:px-[25%] mb-12 text-xl">
        <div class="w-full">
            <div class="flex flex-row justify-between w-full text-gray-600">
                <div> Commit: {commitCounter} </div>
                <div> Repository: {repoCounter} / {repoListLength} </div>
            </div>
            {#if processing}
                <div class="w-full">
                    <span class="loader"></span>
                </div>
            {:else if isDone}
                <div class="w-full">
                    <span class="loader-static bg-green-500"></span>
                </div>    
            {:else}
                <div class="w-full">
                    <span class="loader-static bg-gray-300"></span> 
                </div>
            {/if}
        </div>

        <div class="w-full">
            <div class="flex flex-row gap-1">
                <h3 class="font-bold uta">Usernames</h3>
                <Popover.Root>
                    <Popover.Trigger><svg class="w-4 h-4 ml-0 text-gray-400 hover:text-gray-500" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path></svg></Popover.Trigger>
                    <Popover.Content>Usernames attributed to the account</Popover.Content>
                </Popover.Root>
            </div>
            
            <div class="ml-2 pt-4">
                {#if Object.keys(usernameMapping).length}
                    {#each Object.entries(usernameMapping) as [u, link]}
                        <a class="underline decoration-0 break-all text-sm md:text-base lg:text-lg" href={link}>{u}</a> <br />
                    {/each}
                {/if}
            </div>

        </div>

        <div class="w-full">
            <div class="flex flex-row gap-1 ">
                <h3 class="font-bold">Emails</h3>
                <Popover.Root>
                    <Popover.Trigger><svg class="w-4 h-4 ml-0 text-gray-400 hover:text-gray-500" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path></svg></Popover.Trigger>
                    <Popover.Content>Emails attributed to the account</Popover.Content>
                </Popover.Root>
            </div>
            <div class="ml-2 pt-4">
                {#if Object.keys(emailMapping).length}
                    {#each Object.entries(emailMapping) as [e, link]}
                        <a class="underline decoration-0 break-all text-sm md:text-base lg:text-lg" href={link}>{e}</a> <br />
                    {/each}
                {/if}
            </div>

        </div>

        <div class="w-full">
            <div class="flex flex-row gap-1">
                <h3 class="font-bold">Unknown</h3>
                <Popover.Root>
                    <Popover.Trigger><svg class="w-4 h-4 ml-0 text-gray-400 hover:text-gray-500" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path></svg></Popover.Trigger>
                    <Popover.Content>Emails/Usernames from authorless commits</Popover.Content>
                </Popover.Root>
            </div>
            <div class="ml-2 pt-4">
                {#if Object.keys(unknownMapping).length}
                    {#each Object.entries(unknownMapping) as [un, link]}
                        <a class="underline decoration-0 break-all text-sm md:text-base lg:text-lg" href={link}>{un}</a> <br />
                    {/each}
                {/if}
            </div>

        </div>
    </div>

    <div class="flex flex-col items-center px-8 lg:px-[25%] text-lg">
        <Accordion.Root class="w-full">
            
            <Accordion.Item value="item-1">
            <Accordion.Trigger>Functionality</Accordion.Trigger>
                <Accordion.Content class="text-base">
                    Search through public GitHub commits to retrieve usernames and emails associated with an account.
                </Accordion.Content>
            </Accordion.Item>
            
            <Accordion.Item value="item-2">
                <Accordion.Trigger>How it Works</Accordion.Trigger>
                    <Accordion.Content class="text-base">
                    1. Fetch a list of public repositories from the user profile using the GitHub API.
                    <br />
                    <br />
                    2. Get the 200 most recent commits for each public repository using the GitHub API.
                    <br />
                    <br />
                    3. Display the username and email addresses if the author matches the provided account name.  
                    <br />
                </Accordion.Content>
            </Accordion.Item>
            
            <Accordion.Item value="item-3">
                <Accordion.Trigger>Are Searches Private?</Accordion.Trigger>
                    <Accordion.Content class="text-base">
                    All requests are client-side, meaning GitHub will know your IP address. A VPN can cause requests to fail, use one at your own discretion.
                    <br />
                    <br />
                    Searches are between you and GitHub. This website is open-source, MIT licensed, and does not log or collect search data. 
                </Accordion.Content>
            </Accordion.Item>

            <Accordion.Item value="item-4">
                <Accordion.Trigger>Can I See The Code?</Accordion.Trigger>
                    <Accordion.Content class="text-base">
                    Yes. You can visit the <a href="https://github.com/RonanChance/git-detective" class="text-blue-600 underline">GitHub</a> to see more details.
                    <br />
                    <br />
                    The TypeScript code for this page is shown below:
                    <br />
                    <br />
                    <div class="bg-gray-100 rounded-sm whitespace-pre overflow-x-scroll text-sm md:text-base lg:text-lg">
                        {tsCode}
                    </div>
                </Accordion.Content>
            </Accordion.Item>
        
        </Accordion.Root>
    </div>

    <div class="flex flex-col items-center mt-12 mb-12">
        <a href="https://github.com/RonanChance/git-detective">
        <svg width="48px" height="48px" viewBox="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" fill="#000101"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <title>github [#142]</title> <desc>Created with Sketch.</desc> <defs> </defs> <g id="Page-1" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd"> <g id="Dribbble-Light-Preview" transform="translate(-140.000000, -7559.000000)" fill="#000101"> <g id="icons" transform="translate(56.000000, 160.000000)"> <path d="M94,7399 C99.523,7399 104,7403.59 104,7409.253 C104,7413.782 101.138,7417.624 97.167,7418.981 C96.66,7419.082 96.48,7418.762 96.48,7418.489 C96.48,7418.151 96.492,7417.047 96.492,7415.675 C96.492,7414.719 96.172,7414.095 95.813,7413.777 C98.04,7413.523 100.38,7412.656 100.38,7408.718 C100.38,7407.598 99.992,7406.684 99.35,7405.966 C99.454,7405.707 99.797,7404.664 99.252,7403.252 C99.252,7403.252 98.414,7402.977 96.505,7404.303 C95.706,7404.076 94.85,7403.962 94,7403.958 C93.15,7403.962 92.295,7404.076 91.497,7404.303 C89.586,7402.977 88.746,7403.252 88.746,7403.252 C88.203,7404.664 88.546,7405.707 88.649,7405.966 C88.01,7406.684 87.619,7407.598 87.619,7408.718 C87.619,7412.646 89.954,7413.526 92.175,7413.785 C91.889,7414.041 91.63,7414.493 91.54,7415.156 C90.97,7415.418 89.522,7415.871 88.63,7414.304 C88.63,7414.304 88.101,7413.319 87.097,7413.247 C87.097,7413.247 86.122,7413.234 87.029,7413.87 C87.029,7413.87 87.684,7414.185 88.139,7415.37 C88.139,7415.37 88.726,7417.2 91.508,7416.58 C91.513,7417.437 91.522,7418.245 91.522,7418.489 C91.522,7418.76 91.338,7419.077 90.839,7418.982 C86.865,7417.627 84,7413.783 84,7409.253 C84,7403.59 88.478,7399 94,7399" id="github-[#142]"> </path> </g> </g> </g> </g></svg>
        </a>
    </div>

</div>

<style>

.loader-static {
    width: 100%;
    height: 4.8px;
    display: inline-block;
    position: relative;
    overflow: hidden;
}

.loader {
    width: 100%;
    height: 4.8px;
    display: inline-block;
    position: relative;
    background: #D1D5DB;
    overflow: hidden;
}

.loader::after {
    content: '';
    height: 4.8px;
    background: #000000;
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: border-box;
    animation: animloader 1.5s linear infinite;
}

@keyframes animloader {
    0% {
        left:0%;
        right:100%;
        width:0%;
    }
    10% {
        left:0%;
        right:75%;
        width:35%;
    }
    90% {
        right:0%;
        left:75%;
        width:35%;
    }
    100% {
        left:100%;
        right:0%;
        width:0%;
    }
}

</style>
