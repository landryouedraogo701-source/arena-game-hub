package com.arena.gamehub;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager.NameNotFoundException;

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
            call.reject("Identifiant Android du jeu manquant.");
            return;
        }

        try {

            PackageManager packageManager =
                    getContext().getPackageManager();

            // Vérification réelle de l'installation
            ApplicationInfo applicationInfo =
                    packageManager.getApplicationInfo(packageName, 0);

            JSObject result = new JSObject();
            result.put("installed", true);
            result.put("packageName", packageName);
            result.put(
                    "appName",
                    packageManager.getApplicationLabel(applicationInfo).toString()
            );

            // Recherche de l'activité principale du jeu
            Intent launchIntent =
                    packageManager.getLaunchIntentForPackage(packageName);

            if (launchIntent == null) {

                result.put("launchable", false);

                call.reject(
                    "Le jeu est installé mais Android ne trouve aucune activité "
                    + "de lancement pour " + packageName
                );

                return;
            }

            result.put("launchable", true);
            result.put("action", launchIntent.getAction());

            if (launchIntent.getComponent() != null) {
                result.put(
                    "component",
                    launchIntent.getComponent().flattenToString()
                );
            }

            // Sécurise le lancement vers le bon package
            launchIntent.setPackage(packageName);

            launchIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED
            );

            // Lancement réel
            getContext().startActivity(launchIntent);

            call.resolve(result);

        } catch (NameNotFoundException error) {

            call.reject(
                "Android ne trouve pas le jeu installé. "
                + "Package recherché : "
                + packageName
                + " | "
                + error.getClass().getSimpleName()
                + ": "
                + error.getMessage()
            );

        } catch (Exception error) {

            String message = error.getMessage();

            if (message == null || message.trim().isEmpty()) {
                message = "aucun détail fourni par Android";
            }

            call.reject(
                "Erreur Android lors du lancement de "
                + packageName
                + " | "
                + error.getClass().getSimpleName()
                + ": "
                + message
            );
        }
    }
}
