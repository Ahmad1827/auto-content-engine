// ACE.exe: installs ACE into %LOCALAPPDATA%\ACE the first time and after an update, then opens the app.
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <windows.h>
#include "script.h"

static char base[MAX_PATH];

static void leave(int code) {
    ShowWindow(GetConsoleWindow(), SW_SHOW);
    printf("\nPress Enter to close this window.");
    fflush(stdout);
    getchar();
    exit(code);
}

static int run(char *line, const char *dir) {
    STARTUPINFOA si = {sizeof(si)};
    PROCESS_INFORMATION pi;
    DWORD code = 1;
    if (!CreateProcessA(NULL, line, NULL, NULL, FALSE, 0, NULL, dir, &si, &pi)) return -1;
    WaitForSingleObject(pi.hProcess, INFINITE);
    GetExitCodeProcess(pi.hProcess, &code);
    CloseHandle(pi.hProcess);
    CloseHandle(pi.hThread);
    return (int)code;
}

static int installed(void) {
    char path[MAX_PATH + 32], found[64] = "";
    snprintf(path, sizeof(path), "%s\\.version", base);
    FILE *f = fopen(path, "r");
    if (!f) return 0;
    if (!fgets(found, sizeof(found), f)) found[0] = 0;
    fclose(f);
    found[strcspn(found, "\r\n")] = 0;
    return strcmp(found, ACE_VERSION) == 0;
}

static int install(void) {
    char script[MAX_PATH + 32], line[MAX_PATH * 2];
    GetTempPathA(MAX_PATH, script);
    strcat(script, "ace-setup.ps1");
    FILE *f = fopen(script, "wb");
    if (!f) return -1;
    fwrite(SETUP_PS1, 1, SETUP_PS1_LEN, f);
    fclose(f);
    printf("\nInstalling ACE. This needs internet, takes about 10 minutes and uses about 3 GB. It only happens once.\n");
    snprintf(line, sizeof(line), "powershell.exe -NoProfile -ExecutionPolicy Bypass -File \"%s\" -Version %s", script, ACE_VERSION);
    int code = run(line, NULL);
    DeleteFileA(script);
    return code;
}

int main(void) {
    SetConsoleTitleA("ACE - Auto Content Engine");
    printf("ACE %s\n", ACE_VERSION);
    const char *local = getenv("LOCALAPPDATA");
    if (!local) {
        printf("\nCouldn't find your AppData folder.\n");
        leave(1);
    }
    snprintf(base, sizeof(base), "%s\\ACE", local);
    CreateDirectoryA(base, NULL);

    if (!installed()) {
        int code = install();
        if (code != 0) {
            printf("\nThe install stopped with error %d. The messages above say why, and it's usually the internet connection. Run ACE.exe again to carry on.\n", code);
            leave(code);
        }
    }

    // Programs ACE starts use this hidden console, so that they don't flash up windows of their own.
    DWORD ours[4];
    if (GetConsoleProcessList(ours, 4) == 1) ShowWindow(GetConsoleWindow(), SW_HIDE);

    char path[32767], line[MAX_PATH * 2], dir[MAX_PATH + 8];
    const char *old = getenv("PATH");
    snprintf(path, sizeof(path), "%s\\python;%s\\python\\Scripts;%s\\node;%s\\ffmpeg\\bin;%s", base, base, base, base, old ? old : "");
    SetEnvironmentVariableA("PATH", path);
    SetEnvironmentVariableA("PYTHONUTF8", "1");
    // Our own temp folder: the system one can be cleaned while a render is still using it.
    char temp[MAX_PATH + 8];
    snprintf(temp, sizeof(temp), "%s\\temp", base);
    CreateDirectoryA(temp, NULL);
    SetEnvironmentVariableA("TEMP", temp);
    SetEnvironmentVariableA("TMP", temp);
    snprintf(dir, sizeof(dir), "%s\\app", base);
    snprintf(line, sizeof(line), "\"%s\\python\\python.exe\" run.py", base);
    int code = run(line, dir);
    if (code != 0) {
        printf("\nACE stopped with error %d. The messages above say why.\n", code);
        leave(code);
    }
    return 0;
}
