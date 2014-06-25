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

public class DroidInspector {

    private static final String INSERTFILE = "INSERTFILE";
    private static final String DEVICEDATA = "DEVICEDATA";

    public static void main(String args[]) {
        DroidClient client = new DroidClient();

        File file = new File(".", "droid-inspector.html");
        OutputStreamWriter output = null;

        try {
            output = new OutputStreamWriter(new FileOutputStream(file));
            printFile(client, output, "index.html");
            printSuccess();
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            if (output != null) {
                try {
                    output.close();
                } catch (IOException e) { }
            }
        }
    }

    private static void printFile(DroidClient client, OutputStreamWriter output, String file) throws Exception {
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
                    client.printData(output);
                    } catch (IOException e) {
                        printError("Y U NO ADB FORWARD?", "Please enable adb forwarding. Usually:\nadb forward tcp:5555 tcp:5555");
                        throw new IOException(e);
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

    private static void printError(String message, String rectify) {
        System.out.println("----------------------------------------");
        final int length = message.length();
        if (length < 40) {
            for (int i = 0; i < length/2; i++, System.out.print(" "));
        }
        System.out.println(message);
        System.out.println("----------------------------------------");
        System.out.println(rectify);
        System.out.println("----------------------------------------");
    }

    private static void printSuccess() {
        System.out.println("****************************************");
        System.out.println("\nUI dump file created successfully.");
        System.out.println("Open droid-inspector.html (in current");
        System.out.println("directory) to view the results.\n");
        System.out.println("****************************************");
    }
}
