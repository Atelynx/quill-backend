# Real time market gateway
Implement market gateway to retrieve realtime data using the service layer data, emiting the necessary real-time data instead of fetching manually, emiting real-time changes and design a modular gateway to implement different types of flow data and information. 

Use market gateway to retrieve all the necessary data to display and use the stocks and flow changes in real time, now the application use REST request, emit the event everytime the value changes, and tick every a env value

## Goals
+ Offer a modular aggregation real-time data using the existing service data or future services, make it easy to inject certain services like connecting a currency exchange provider to the gateway to provide real-time data changes of the currency.
+ Configurable gateway using env configuration for ticks and general configuration for each implementation.
+ Retrieve all the necessary real-time data to make correct transactions and stock exchange, emit changes and detail real-time time user flow.

