import {
    accountLogout,
    logoutClearStateAgain,
} from "@/accounts/services/logout";
import log from "@/base/log";
import { resetUploadState } from "@/gallery/upload";
import DownloadManager from "@/new/photos/services/download";
import { logoutML, terminateMLWorker } from "@/new/photos/services/ml";
import { logoutSearch } from "@/new/photos/services/search";
import { logoutSettings } from "@/new/photos/services/settings";
import { logoutUserDetails } from "@/new/photos/services/user-details";
import exportService from "./export";

/**
 * Logout sequence for the photos app.
 *
 * This function is guaranteed not to throw any errors.
 *
 * See: [Note: Do not throw during logout].
 */
export const photosLogout = async () => {
    const ignoreError = (label: string, e: unknown) =>
        log.error(`Ignoring error during logout (${label})`, e);

    // - Workers

    // Terminate any workers that might access the DB before clearing persistent
    // state. See: [Note: Caching IDB instances in separate execution contexts].

    try {
        await terminateMLWorker();
    } catch (e) {
        ignoreError("ml/worker", e);
    }

    // - Remote logout and clear state

    await accountLogout();

    // - Photos specific logout

    log.info("logout (photos)");

    try {
        logoutSettings();
    } catch (e) {
        ignoreError("settings", e);
    }

    try {
        logoutUserDetails();
    } catch (e) {
        ignoreError("userDetails", e);
    }

    try {
        resetUploadState();
    } catch (e) {
        ignoreError("upload", e);
    }

    try {
        DownloadManager.logout();
    } catch (e) {
        ignoreError("download", e);
    }

    try {
        logoutSearch();
    } catch (e) {
        ignoreError("search", e);
    }

    // - Desktop

    const electron = globalThis.electron;
    if (electron) {
        try {
            await logoutML();
        } catch (e) {
            ignoreError("ML", e);
        }

        try {
            exportService.disableContinuousExport();
        } catch (e) {
            ignoreError("export", e);
        }

        try {
            await electron.logout();
        } catch (e) {
            ignoreError("electron", e);
        }
    }

    // Clear the DB again to discard any in-flight completions that might've
    // happened since we started.

    await logoutClearStateAgain();

    // Do a full reload to discard any in-flight requests that might still
    // remain.

    window.location.replace("/");
};
