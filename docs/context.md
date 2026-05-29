A web platform designed to simulate stock trading transactions, its objective is to allow users to visualize the fluctuations in the value of their virtual shares in relation to real market flows. The simulation aims to facilitate the verification and refinement of the user's investment decisions, enabling them to evaluate the accuracy of their analyses and research on companies. Furthermore, it seeks to improve investor performance and skill by incorporating gamification mechanisms, such as the use of virtual capital for buying and selling, in order to increase engagement and the relevance of decisions in the investment process

The market data provider is pluggable via `MARKET_PROVIDER` env var. Current implementations:

- `mock`: deterministic seed data for development and testing (default)
- `eodhd`: fetches real data from EODHD Historical Data API for Chilean stocks

The provider abstraction (`MarketDataProvider` interface) allows adding new sources without changing business logic.