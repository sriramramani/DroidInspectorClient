/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

package com.sriramramani.droid.inspector.client;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.net.InetSocketAddress;
import java.nio.channels.SocketChannel;

/**
 * DroidClient receives actual data from the client.
 * <p />
 * Creates a TCP socket to receive and print the UI hierarchy.
 */
public class DroidClient {
    private static final String LOCAL_HOST = "127.0.0.1";
    public static final int DEFAULT_LOCAL_PORT = 5555;

    // Magic command to print the hierarchy.
    public static final String COMMAND_PRINT_HIERARCHY = "print json";

    // Error message.
    public static final String ERROR_SERVER_NOT_RESPONDING = "Server not responding";

    /**
     * Prints the data from the app to a file.
     *
     * @param output The output stream to which the received data should be printed.
     * @throws IOException
     * @throws IllegalStateException
     */
    public void printData(OutputStreamWriter output, int localPort) throws IOException, IllegalStateException {
        SocketChannel channel = SocketChannel.open();
        channel.connect(new InetSocketAddress(LOCAL_HOST, localPort));
        channel.socket().setSoTimeout(15000);

        BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(channel.socket().getOutputStream()));
        writer.write(COMMAND_PRINT_HIERARCHY);
        writer.newLine();
        writer.flush();

        System.out.println("Status: Connection with the device...");

        BufferedReader reader = new BufferedReader(new InputStreamReader(channel.socket().getInputStream()), 8 * 1024);

        boolean receivedData = false;

        String line = null;
        while ((line = reader.readLine()) != null) {
            output.write(line);

            if (!receivedData) {
                receivedData = true;
            }
        }

        if (!receivedData) {
            throw new IllegalStateException(ERROR_SERVER_NOT_RESPONDING);
        }

        writer.close();
        reader.close();
        channel.close();
    }
}
