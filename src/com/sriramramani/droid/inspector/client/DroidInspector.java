/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package com.sriramramani.droid.inspector.client;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.util.HashMap;
import java.util.Map;

/**
 * DroidInspector is the main class handling the user input.
 */
public class DroidInspector {

    // Markers in static files to insert data.
    private static final String INSERTFILE = "INSERTFILE";
    private static final String DEVICEDATA = "DEVICEDATA";

    private static final String ARG_FILE = "--file";
    private static final String ARG_LOCAL_PORT = "--local-port";
    private static final String ARG_HELP = "--help";

    private static final String ERROR_NO_FILENAME = "No file specified";
    private static final String ERROR_NO_LOCAL_PORT = "No local port specified";

    private static final Map<String, String> ERRORS = new HashMap<String, String>();

    static {
        // Command line errors.
        ERRORS.put(ERROR_NO_FILENAME,
                "Specify a valid filename");

        ERRORS.put(ERROR_NO_LOCAL_PORT,
                "Specify a valid local port\n" +
                "used in the ADB FORWARD");

        // TCP Errors.
        ERRORS.put("Connection refused",
                "Enable ADB Forwarding:\n    adb forward tcp:5555 tcp:5555");

        ERRORS.put("Connection reset by peer",
                "App is probably not running.\n" +
                "Check if app has INTERNET permission.\n" +
                "Check if the DroidInspector Server is running.");

        // DroidInspector Errors.
        ERRORS.put(DroidClient.ERROR_SERVER_NOT_RESPONDING,
                "DroidInspector Server is not responding.\n" +
                "Check if the activity is not paused.\n" +
                "Check if there is a valid focused window.");
    }

    private static String sFileName = "./droid-inspector.html";
    private static int sLocalPort = DroidClient.DEFAULT_LOCAL_PORT;

    /**
     * Entry point of the client.
     *
     * @param args The command line arguments.
     */
    public static void main(String args[]) {
        // Parse the arguments.
        if (!parseArguments(args)) {
            return;
        }

        DroidClient client = new DroidClient();

        File file = new File(sFileName);
        OutputStreamWriter output = null;

        try {
            output = new OutputStreamWriter(new FileOutputStream(file));
            printFile(client, output, "index.html");
            printSuccess();
        } catch (Exception e) {
        } finally {
            if (output != null) {
                try {
                    output.close();
                } catch (IOException e) { }
            }
        }
    }

    /**
     * Parses the command line arguments.
     * @param args The command line arguments.
     * @return true if the parsing was successful.
     */
    private static boolean parseArguments(String args[]) {
        for (int i = 0; i < args.length; ) {
            String arg = args[i];
            if (ARG_FILE.equals(arg)) {
                if (i+1 < args.length) {
                    sFileName = args[i+1];
                    i+=2;
                } else {
                    printError(ERROR_NO_FILENAME);
                    return false;
                }
            } else if (ARG_LOCAL_PORT.equals(arg)) {
                if (i+1 < args.length) {
                    sLocalPort = Integer.parseInt(args[i+1]);
                    i+=2;
                } else {
                    printError(ERROR_NO_LOCAL_PORT);
                    return false;
                }
            } else if (ARG_HELP.equals(arg)) {
                printHelp();
                return false;
            } else {
                printHelp();
                return false;
            }
        }

        return true;
    }

    /**
     * Writes a given file to the disk.
     *
     * @param client The app that has DroidInspector server running.
     * @param output The output stream of the file.
     * @param file The name of the file.
     * @throws Exception
     */
    private static void printFile(DroidClient client, OutputStreamWriter output, String file) throws Exception {
        // The file is usually a static file bundled with the jar.
        InputStream in = client.getClass().getResourceAsStream(file);
        BufferedReader fr = null;
        try {
            fr = new BufferedReader(new InputStreamReader(in, "utf-8"), 1024);

            String line;
            while((line = fr.readLine()) != null) {
                if (line.contains(INSERTFILE)) {
                    final int beginIndex = line.indexOf(INSERTFILE) + INSERTFILE.length() + 1;
                    final int endIndex = line.indexOf(' ', beginIndex);
                    final String fileName = line.substring(beginIndex, endIndex);
                    printFile(client, output, fileName);
                } else if (line.contains(DEVICEDATA)) {
                    output.write("var json = ");
                    try {
                        client.printData(output, sLocalPort);
                    } catch (Exception e) {
                        printError(e.getMessage());
                        throw new Exception(e);
                    }
                    output.write(";");
                } else {
                    output.write(line);
                    output.write("\n");
                }
            }
            fr.close();
            in.close();
        } catch (Exception e) {
            throw new Exception(e);
        }
    }

    /**
     * Prints an error message.
     * @param message The error message.
     */
    private static void printError(String message) {
        String errorMessage = "Error: " + message;
        String rectify = ERRORS.get(message);

        System.out.println("----------------------------------------");
        final int length = errorMessage.length();
        if (length < 40) {
            for (int i = 0; i < (40 - length)/2; i++, System.out.print(" "));
        }
        System.out.println(errorMessage);
        System.out.println("----------------------------------------");

        if (rectify != null) {
            System.out.println(rectify);
            System.out.println("----------------------------------------");
        }
    }

    /**
     * Prints a success message.
     */
    private static void printSuccess() {
        System.out.println("****************************************");
        System.out.println("UI dump file created successfully.");
        System.out.println("Open " + sFileName +  " to view the results.");
        System.out.println("****************************************");
    }

    /**
     * Prints a help message.
     */
    private static void printHelp() {
        System.out.println("Usage: java -jar droidinspectorclient.jar [--file filename] [--local-port local-port]");
        System.out.println("--file          - specify an alternative file name");
        System.out.println("--local-port    - specify an alternative local-port used for adb forward");
        System.out.println("                  adb forward tcp:xxxx tcp:5555");
        System.out.println("--help          - prints this help message");
    }
}
