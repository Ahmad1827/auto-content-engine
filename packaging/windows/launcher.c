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

static void leave(int code) {
    printf("\nPress Enter to close this window.");
    fflush(stdout);
    getchar();
    exit(code);
}

// The script travels on the command line, so the install can still use this console.
static int phase(const char *user, const char *name) {
    size_t size = sizeof(SCRIPT_B64) + 512;
    char *command = malloc(size);
    snprintf(command, size, "wsl.exe %s -e bash -c \"echo %s | base64 -d > /tmp/ace-launch-%s.sh && ACE_VERSION=%s bash /tmp/ace-launch-%s.sh %s\"", user, SCRIPT_B64, name, ACE_VERSION, name, name);
    int code = run(command);
    free(command);
    return code;
}

int main(void) {
    SetConsoleTitleA("ACE - Auto Content Engine");
    printf("ACE %s\n", ACE_VERSION);

    if (run("wsl.exe -e true") != 0) {
        printf("\nACE runs inside WSL (Windows Subsystem for Linux), and it isn't set up on this PC.\n\n");
        printf("Install it now? Windows will ask for permission, and you'll need to restart afterwards. [y/n] ");
        fflush(stdout);
        int answer = getchar();
        if (answer != 'y' && answer != 'Y') leave(1);
        ShellExecuteA(NULL, "runas", "wsl.exe", "--install -d Ubuntu", NULL, SW_SHOWNORMAL);
        printf("\nWhen that window finishes, restart your PC, open Ubuntu once from the Start menu to choose a username, and then run ACE.exe again.\n");
        leave(0);
    }

    printf("\nThe first launch installs everything and takes several minutes. After that, ACE opens straight away.\n");
    int code = phase("-u root", "root");
    if (code != 0) {
        printf("\nCouldn't install the system packages (error %d). Check your internet connection and try again.\n", code);
        leave(code);
    }
    code = phase("", "user");
    if (code != 0) {
        printf("\nACE stopped with error %d. The messages above say why.\n", code);
        leave(code);
    }
    return 0;
}
