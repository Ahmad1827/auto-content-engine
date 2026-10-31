// ACE.exe: the app runs inside WSL, so this checks WSL is there, has it set everything up the first time, and opens the app.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <windows.h>
#include "script.h"

static int run(const char *command) {
    STARTUPINFOA si = {sizeof(si)};
    PROCESS_INFORMATION pi;
    DWORD code = 1;
    char *line = _strdup(command);
    if (!CreateProcessA(NULL, line, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) {
        free(line);
        return -1;
    }
    WaitForSingleObject(pi.hProcess, INFINITE);
    GetExitCodeProcess(pi.hProcess, &code);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    free(line);
    return (int)code;
}

// Runs a command with its output kept out of the console. Fills `out` if it's given.
static int capture(const char *command, char *out, size_t size) {
    SECURITY_ATTRIBUTES sa = {sizeof(sa), NULL, TRUE};
    HANDLE read, write;
    if (!CreatePipe(&read, &write, &sa, 0)) return -1;
    SetHandleInformation(read, HANDLE_FLAG_INHERIT, 0);
    STARTUPINFOA si = {sizeof(si)};
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdOutput = si.hStdError = write;
    si.hStdInput = GetStdHandle(STD_INPUT_HANDLE);
    PROCESS_INFORMATION pi;
    char *line = _strdup(command);
    BOOL started = CreateProcessA(NULL, line, NULL, NULL, TRUE, 0, NULL, NULL, &si, &pi);
    free(line);
    CloseHandle(write);
    size_t used = 0;
    DWORD got = 0;
    char chunk[1024];
    while (started && ReadFile(read, chunk, sizeof(chunk), &got, NULL) && got) {
        for (DWORD i = 0; i < got; i++) {
            // wsl.exe writes UTF-16, so the zero bytes between letters are dropped.
            if (out && chunk[i] && used + 1 < size) out[used++] = chunk[i];
        }
    }
    if (out) out[used] = 0;
    CloseHandle(read);
    if (!started) return -1;
    DWORD code = 1;
    WaitForSingleObject(pi.hProcess, INFINITE);
    GetExitCodeProcess(pi.hProcess, &code);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    return (int)code;
}

// The default distribution can't be trusted: Docker Desktop's has no bash or apt. Picks an Ubuntu if there is one, or else any distribution with apt.
static int find_distro(char *name, size_t size) {
    char list[4096];
    if (capture("wsl.exe -l -q", list, sizeof(list)) != 0) return 0;
    for (int ubuntu_only = 1; ubuntu_only >= 0; ubuntu_only--) {
        char copy[4096];
        strcpy(copy, list);
        for (char *d = strtok(copy, "\r\n"); d; d = strtok(NULL, "\r\n")) {
            if (ubuntu_only && _strnicmp(d, "Ubuntu", 6) != 0) continue;
            char test[512];
            snprintf(test, sizeof(test), "wsl.exe -d %s -e sh -c \"command -v apt-get && command -v bash\"", d);
            if (capture(test, NULL, 0) == 0) {
                snprintf(name, size, "%s", d);
                return 1;
            }
        }
    }
    return 0;
}

static void leave(int code) {
    printf("\nPress Enter to close this window.");
    fflush(stdout);
    getchar();
    exit(code);
}

// The script travels on the command line, so the install can still use this console.
static int phase(const char *distro, const char *user, const char *name) {
    size_t size = sizeof(SCRIPT_B64) + 512;
    char *command = malloc(size);
    snprintf(command, size, "wsl.exe -d %s %s -e bash -c \"echo %s | base64 -d > /tmp/ace-launch-%s.sh && ACE_VERSION=%s bash /tmp/ace-launch-%s.sh %s\"", distro, user, SCRIPT_B64, name, ACE_VERSION, name, name);
    int code = run(command);
    free(command);
    return code;
}

int main(void) {
    SetConsoleTitleA("ACE - Auto Content Engine");
    printf("ACE %s\n", ACE_VERSION);

    char distro[256];
    if (!find_distro(distro, sizeof(distro))) {
        printf("\nACE runs inside WSL (Windows Subsystem for Linux) with Ubuntu, and that isn't set up on this PC.\n\n");
        printf("Install it now? Windows will ask for permission, and you'll need to restart afterwards. [y/n] ");
        fflush(stdout);
        int answer = getchar();
        if (answer != 'y' && answer != 'Y') leave(1);
        ShellExecuteA(NULL, "runas", "wsl.exe", "--install -d Ubuntu", NULL, SW_SHOWNORMAL);
        printf("\nWhen that window finishes, restart your PC, open Ubuntu once from the Start menu to choose a username, and then run ACE.exe again.\n");
        leave(0);
    }

    printf("\nThe first launch installs everything and takes several minutes. After that, ACE opens straight away.\n");
    printf("Using %s.\n", distro);
    int code = phase(distro, "-u root", "root");
    if (code != 0) {
        printf("\nCouldn't install the system packages (error %d). The messages above say why; it's usually the internet connection.\n", code);
        leave(code);
    }
    code = phase(distro, "", "user");
    if (code != 0) {
        printf("\nACE stopped with error %d. The messages above say why.\n", code);
        leave(code);
    }
    return 0;
}
