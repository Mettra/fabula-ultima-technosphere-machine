# Animation Development System

This document describes the dynamic animation reloading and testing system implemented for the Fabula Ultima Technosphere Machine module.

## Features

### 🔥 Hot Reloading
- **Dynamic Module Reloading**: Reload animation code without restarting Foundry VTT
- **Automatic Cleanup**: Properly cleans up running animations before reload
- **Cache Busting**: Ensures fresh code is loaded every time

### ⌨️ Quick Testing
- **Ctrl+R**: Play test animation with cycling scenarios
- **Ctrl+L**: Reload animation module (changed from Ctrl+T to avoid browser tab conflict)
- **Click to Close**: Click anywhere on animation overlay to close (dev mode only)

### 🎯 Test Scenarios
- **Predefined Scenarios**: Multiple test cases with different rarities and effects
- **Cycling System**: Sequential testing through all scenarios
- **Random Testing**: Generate random test data
- **Rarity Testing**: Test specific rarity types

### 🎨 Visual Debug Tools
- **Development Overlay**: Real-time status and controls
- **Scenario Info**: Current test scenario and position in cycle
- **Click Controls**: Mouse-friendly testing interface
- **Visual Hints**: Clear indicators for dev mode features

## Usage

### Basic Testing
1. **Enable Development Mode**: Set `DEV_MODE = true` in `core-config.ts`
2. **Load Module**: Start Foundry VTT with the module enabled
3. **Test Animation**: Press `Ctrl+R` to run test animation
4. **Cycle Scenarios**: Each `Ctrl+R` cycles to the next test scenario

### Hot Reloading
1. **Make Changes**: Edit animation code in `Mnemosphere-animation.ts`
2. **Build**: Run `npm run build` or use watch mode with `npm run watch`
3. **Reload**: Press `Ctrl+L` to reload the animation module
4. **Test**: Press `Ctrl+R` to test your changes

### Development Overlay
The development overlay appears in the top-right corner when dev mode is active:
- **Current Scenario**: Shows active test scenario name and position
- **Status**: Displays last reload time and current state
- **Buttons**: Click alternatives to keyboard shortcuts

## Technical Implementation

### File Structure
```
scripts/animations/
├── Mnemosphere-animation.ts      # Main animation code
├── animation-dev-manager.ts      # Development system manager
├── animation-hot-reload.ts       # Hot reload functionality
└── animation-test-data.ts        # Test scenarios and data
```

### Key Components

#### AnimationDevManager
- Manages keyboard event handlers
- Controls debug overlay
- Coordinates testing and reloading

#### Hot Reload System
- Dynamic ES module importing
- Animation state cleanup
- Container preservation

#### Test Data System
- Predefined test scenarios
- Scenario cycling logic
- Random data generation

### Configuration

#### Development Mode
```typescript
// core-config.ts
export const DEV_MODE = true; // Set to false for production
export const ANIMATION_TEST_KEY = 'KeyR';
export const ANIMATION_RELOAD_KEY = 'KeyT';
export const ANIMATION_DEV_MODIFIER = 'ctrlKey';
```

#### Test Scenarios
```typescript
// animation-test-data.ts
export const TEST_SCENARIOS: MnemosphereTestData[] = [
    {
        itemName: "Basic Crystal Shard",
        rarity: "common",
        imageUrl: "modules/.../assets/mnemosphere-blank.png",
        effects: ["sparkle"]
    },
    // ... more scenarios
];
```

## Production Deployment

For production builds:

1. **Disable Dev Mode**: Set `DEV_MODE = false` in `core-config.ts`
2. **Build**: Run `npm run build`
3. **Deploy**: The development system will be completely inactive

## Performance Notes

- **Dev Mode Only**: All development features are disabled in production
- **Minimal Overhead**: Hot reload system only loads when needed
- **Clean Cleanup**: Proper animation state management prevents memory leaks
- **Fast Iteration**: Typical reload + test cycle takes < 2 seconds

## Troubleshooting

### Hot Reload Not Working
- Check browser console for import errors
- Ensure module is built after code changes
- Try full page reload as fallback (`Ctrl+F5`)

### Keyboard Shortcuts Not Responding
- Ensure Foundry VTT window has focus
- Check that `DEV_MODE = true` in config
- Verify no other modules are intercepting key events

### Animation Not Updating
- Confirm changes were saved and built
- Check that animation container exists in DOM
- Look for JavaScript errors in console

## Future Enhancements

- **Live Reload**: Automatic reloading on file changes
- **Parameter Tweaking**: Real-time animation parameter adjustment
- **Performance Profiling**: Animation performance monitoring
- **Visual Editor**: GUI for creating animation sequences
- **Export System**: Save custom test scenarios

## API Reference

### Key Functions

```typescript
// Test animation with specific scenario
getAnimationDevManager().runAnimationTest(scenario);

// Reload animation module
getAnimationDevManager().reloadAnimation();

// Get current development state
getAnimationDevManager().getState();

// Cycle to next test scenario
cycleTestScenarios();

// Get random test data
getRandomTestScenario();
```

### Event System

The development system integrates with Foundry's hook system:
- `ready`: Initialize development mode
- `hotReload`: Cleanup on module reload

This system significantly accelerates animation development by providing instant feedback and eliminating the need for full Foundry VTT restarts during development.
