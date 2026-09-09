package com.arena.gamehub;

import android.content.Intent;
import android.content.pm.PackageManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

@CapacitorPlugin(name = "GameLauncher")
public class GameLauncherPlugin extends Plugin {

    @PluginMethod
    public void openGame(PluginCall call) {

        String packageName = call.getString("packageName");

        if (packageName == null || packageName.trim().isEmpty()) {
            call.reject("Identifiant du jeu manquant.");
            return;
        }

        try {
            PackageManager packageManager =
                    getContext().getPackageManager();

            Intent launchIntent =
                    packageManager.getLaunchIntentForPackage(packageName);

            if (launchIntent == null) {
                JSObject result = new JSObject();
                result.put("installed", false);
                result.put("packageName", packageName);
                call.resolve(result);
                return;
            }

            launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getContext().startActivity(launchIntent);

            JSObject result = new JSObject();
            result.put("installed", true);
            result.put("packageName", packageName);

            call.resolve(result);

        } catch (Exception error) {

            call.reject(
                "Impossible d'ouvrir le jeu : "
                + error.getMessage()
            );
        }
    }
}
