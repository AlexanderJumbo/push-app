import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { useEffect, useState } from "react";
import { Platform } from "react-native";


Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

interface SendPushOptions {
    to: string[];
    title: string;
    body: string;
    data?: Record<string, any>
}

async function sendPushNotification(options: SendPushOptions) {

    const { to, title, body, data } = options

    const message = {
        to: to,
        sound: "default",
        title: title,
        body: body,
        data: data,
    };

    await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
    });
}

function handleRegistrationError(errorMessage: string) {
    alert(errorMessage);
    throw new Error(errorMessage);
}

async function registerForPushNotificationsAsync() {
    if (Platform.OS === "android") {
        await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF231F7C",
        });
    }
    //* si es un dispositivo físico
    if (Device.isDevice) {
        //* saber si ya se tiene los permisos para enviar notificaciones
        const { status: existingStatus } =
            await Notifications.getPermissionsAsync();

        let finalStatus = existingStatus;
        //* Si no se ha otorgado permisos, los pide        
        if (existingStatus !== "granted") {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        //* El usuario no ha dado permisos, no hay nada que hacer
        if (finalStatus !== "granted") {
            handleRegistrationError(
                "Permission not granted to get push token for push notification!"
            );
            return;
        }

        //* Se obtiene el projectID
        const projectId =
            Constants?.expoConfig?.extra?.eas?.projectId ??
            Constants?.easConfig?.projectId;
        if (!projectId) {
            handleRegistrationError("Project ID not found");
        }
        try {
            const pushTokenString = (
                await Notifications.getExpoPushTokenAsync({
                    projectId,
                })
            ).data;
            //* Identificar un disposito de otro por su OS
            console.log({ [Platform.OS]: pushTokenString });
            return pushTokenString;
        } catch (e: unknown) {
            handleRegistrationError(`${e}`);
        }
    } else {
        handleRegistrationError("Must use physical device for push notifications");
    }
}

//* Bandera para saber cuando los listeners estan listos, y registrarlos una sola vez
let areListenersReady = false;

export const usePushNotifications = () => {
    const [expoPushToken, setExpoPushToken] = useState("");
    const [notifications, setNotifications] = useState<
        Notifications.Notification[]
    >([]);


    useEffect(() => {

        if (areListenersReady) return;

        registerForPushNotificationsAsync()
            .then((token) => setExpoPushToken(token ?? ""))
            .catch((error: any) => setExpoPushToken(`${error}`));
    }, []);

    useEffect(() => {
        //* Evitar el doble registro este mismo efecto
        if (areListenersReady) return
        areListenersReady = true
        const notificationListener = Notifications.addNotificationReceivedListener(
            (notification) => {
                setNotifications([notification, ...notifications]);
            }
        );
        const responseListener =
            Notifications.addNotificationResponseReceivedListener((response) => {
                console.log(response);
            });
        return () => {
            notificationListener.remove();
            responseListener.remove();
        };
    }, []);


    return {
        //* Properties
        expoPushToken,
        notifications,

        //* Methods
        sendPushNotification
    }
}
