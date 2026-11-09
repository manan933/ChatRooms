import React, { useState, useMemo, useRef } from 'react';
import { Search, X } from './Icons';

const CATEGORIES = [
  { id: 'all', label: 'All', icon: '✨' },
  { id: 'recent', label: 'Recent', icon: '🕒' },
  { id: 'smileys', label: 'Smileys', icon: '😀' },
  { id: 'gestures', label: 'Hands', icon: '👍' },
  { id: 'hearts', label: 'Hearts', icon: '❤️' },
  { id: 'vibes', label: 'Vibes', icon: '🔥' },
  { id: 'objects', label: 'Objects', icon: '🚀' },
  { id: 'food', label: 'Food', icon: '☕' },
];

const EMOJI_DATABASE = [
  // ── Vibes & Reactions ──
  { emoji: '👍', name: 'thumbs up like approve +1 yes ok good', category: 'gestures' },
  { emoji: '👎', name: 'thumbs down dislike bad -1 no', category: 'gestures' },
  { emoji: '❤️', name: 'red heart love like adore', category: 'hearts' },
  { emoji: '🔥', name: 'fire flame lit hot awesome trend', category: 'vibes' },
  { emoji: '😂', name: 'laugh crying laughing joy haha lol funny haha rofl', category: 'smileys' },
  { emoji: '🤣', name: 'rolling on floor laughing rofl funny lol', category: 'smileys' },
  { emoji: '⭐', name: 'star gold favorite bookmark shine', category: 'vibes' },
  { emoji: '🤝', name: 'handshake deal partner agree business', category: 'gestures' },
  { emoji: '🎉', name: 'party popper celebrate celebration tada congrats', category: 'vibes' },
  { emoji: '🚀', name: 'rocket launch fast ship startup release', category: 'objects' },
  { emoji: '💯', name: 'hundred 100 perfect score keep it real', category: 'vibes' },
  { emoji: '👏', name: 'clapping hands applause bravo praise good job', category: 'gestures' },
  { emoji: '🙏', name: 'folded hands pray please thanks thank you namaste', category: 'gestures' },
  { emoji: '✨', name: 'sparkles shiny clean magic special star', category: 'vibes' },
  { emoji: '✅', name: 'check checkmark done success verified finished ok', category: 'vibes' },
  { emoji: '⚡', name: 'lightning bolt fast energy quick speed power', category: 'vibes' },
  { emoji: '💡', name: 'light bulb idea insight smart tip note', category: 'objects' },
  { emoji: '👀', name: 'eyes look review peek see watching curious', category: 'smileys' },
  { emoji: '🎯', name: 'target bullseye goal objective hit accurate', category: 'objects' },
  { emoji: '🏆', name: 'trophy winner champion award prize first', category: 'objects' },

  // ── Smileys & Emotions ──
  { emoji: '😀', name: 'grinning face happy smile laugh pleased', category: 'smileys' },
  { emoji: '😃', name: 'grinning face big eyes cheerful excited', category: 'smileys' },
  { emoji: '😄', name: 'smiling face with open mouth happy', category: 'smileys' },
  { emoji: '😁', name: 'beaming face grinning smile teeth', category: 'smileys' },
  { emoji: '😆', name: 'grinning squinting face laugh haha', category: 'smileys' },
  { emoji: '😅', name: 'grinning face with sweat phew relief awkward', category: 'smileys' },
  { emoji: '😊', name: 'smiling face with smiling eyes blush warm glad', category: 'smileys' },
  { emoji: '😇', name: 'smiling face with halo angel innocent holy good', category: 'smileys' },
  { emoji: '🙂', name: 'slightly smiling face smile okay fine', category: 'smileys' },
  { emoji: '🙃', name: 'upside-down face silly sarcasm irony goofy', category: 'smileys' },
  { emoji: '😉', name: 'winking face wink flirt secret joke', category: 'smileys' },
  { emoji: '😍', name: 'heart-eyes smiling love adore crush in love', category: 'smileys' },
  { emoji: '🥰', name: 'smiling face with hearts loving adored affection', category: 'smileys' },
  { emoji: '😘', name: 'face blowing kiss flirt kiss mwah love', category: 'smileys' },
  { emoji: '😋', name: 'face savoring food delicious yummy tasty', category: 'smileys' },
  { emoji: '😛', name: 'face with tongue playful silly tease', category: 'smileys' },
  { emoji: '😜', name: 'winking face with tongue goofy crazy wink', category: 'smileys' },
  { emoji: '🤪', name: 'zany face wild crazy goofy wacky party', category: 'smileys' },
  { emoji: '😎', name: 'smiling face with sunglasses cool boss swag chill', category: 'smileys' },
  { emoji: '🤩', name: 'star-struck excited wow amazed superstar', category: 'smileys' },
  { emoji: '🥳', name: 'partying face party horn celebrate birthday', category: 'smileys' },
  { emoji: '😏', name: 'smirking face smug sly playful smirk', category: 'smileys' },
  { emoji: '😒', name: 'unamused face meh unimpressed annoyed bored', category: 'smileys' },
  { emoji: '🙄', name: 'face with rolling eyes eye roll whatever bored', category: 'smileys' },
  { emoji: '😬', name: 'grimacing face awkward yikes nervous cringe', category: 'smileys' },
  { emoji: '🤥', name: 'lying face pinocchio liar lie nose', category: 'smileys' },
  { emoji: '😌', name: 'relieved face calm peaceful relaxed phew', category: 'smileys' },
  { emoji: '😔', name: 'pensive face sad regret down depressed', category: 'smileys' },
  { emoji: '😪', name: 'sleepy face tired snooze yawn', category: 'smileys' },
  { emoji: '🤤', name: 'drooling face hungry sleep craving', category: 'smileys' },
  { emoji: '😴', name: 'sleeping face sleep zzz bedtime tired', category: 'smileys' },
  { emoji: '😷', name: 'face with medical mask sick doctor mask virus', category: 'smileys' },
  { emoji: '🤒', name: 'face with thermometer fever sick ill temperature', category: 'smileys' },
  { emoji: '🤕', name: 'face with head-bandage hurt injured pain ouch', category: 'smileys' },
  { emoji: '🤢', name: 'nauseated face sick gross disgusted green', category: 'smileys' },
  { emoji: '🤮', name: 'face vomiting barf puke sick gross', category: 'smileys' },
  { emoji: '🥵', name: 'hot face sweating overheated summer heat red', category: 'smileys' },
  { emoji: '🥶', name: 'cold face freezing winter ice frost blue', category: 'smileys' },
  { emoji: '🥴', name: 'woozy face dizzy drunk intoxicated tipsy weird', category: 'smileys' },
  { emoji: '😵', name: 'dizzy face knocked out shocked overwhelmed', category: 'smileys' },
  { emoji: '🤯', name: 'exploding head mind blown shocked stunned wow', category: 'smileys' },
  { emoji: '🤠', name: 'cowboy hat face western sheriff yeehaw', category: 'smileys' },
  { emoji: '🥳', name: 'partying celebration yay cheers', category: 'smileys' },
  { emoji: '🥸', name: 'disguised face glasses mustache incognito secret', category: 'smileys' },
  { emoji: '🤓', name: 'nerd face geek glasses smart study student', category: 'smileys' },
  { emoji: '🧐', name: 'face with monocle examining inspect curious hmm', category: 'smileys' },
  { emoji: '😕', name: 'confused face unsure puzzled hmm', category: 'smileys' },
  { emoji: '😟', name: 'worried face anxious concerned nervous', category: 'smileys' },
  { emoji: '🙁', name: 'slightly frowning face unhappy disappointed', category: 'smileys' },
  { emoji: '😮', name: 'face with open mouth surprised wow whoa', category: 'smileys' },
  { emoji: '😯', name: 'hushed face surprised stunned', category: 'smileys' },
  { emoji: '😲', name: 'astonished face shocked gasping disbelief', category: 'smileys' },
  { emoji: '😳', name: 'flushed face embarrassed shy red blush shocked', category: 'smileys' },
  { emoji: '🥺', name: 'pleading face puppy eyes please beg cute', category: 'smileys' },
  { emoji: '😦', name: 'frowning face with open mouth caught upset', category: 'smileys' },
  { emoji: '😧', name: 'anguished face shocked distressed hurt', category: 'smileys' },
  { emoji: '😨', name: 'fearful face scared frightened afraid', category: 'smileys' },
  { emoji: '😰', name: 'anxious face with sweat nervous panic trouble', category: 'smileys' },
  { emoji: '😥', name: 'sad but relieved face phew close call sweat', category: 'smileys' },
  { emoji: '😢', name: 'crying face tear sad emotional upset', category: 'smileys' },
  { emoji: '😭', name: 'loudly crying face bawling heartbroken tears sob', category: 'smileys' },
  { emoji: '😱', name: 'face screaming in fear home alone scream terror', category: 'smileys' },
  { emoji: '😖', name: 'confounded face struggling frustrated overwhelmed', category: 'smileys' },
  { emoji: '😣', name: 'persevering face endure tough grit pain', category: 'smileys' },
  { emoji: '😞', name: 'disappointed face bummed regret sad', category: 'smileys' },
  { emoji: '😓', name: 'downcast face with sweat stress tired hard work', category: 'smileys' },
  { emoji: '😩', name: 'weary face exhausted overwhelmed helpless', category: 'smileys' },
  { emoji: '😫', name: 'tired face exhausted frustrated done', category: 'smileys' },
  { emoji: '🥱', name: 'yawning face yawn sleepy bored bed', category: 'smileys' },
  { emoji: '😤', name: 'face with steam triumph proud determined huff', category: 'smileys' },
  { emoji: '😡', name: 'enraged face mad red furious angry pout', category: 'smileys' },
  { emoji: '😠', name: 'angry face mad annoyed annoyed frown', category: 'smileys' },
  { emoji: '🤬', name: 'face with symbols on mouth cursing swearing swear angry', category: 'smileys' },
  { emoji: '😈', name: 'smiling face with horns devil naughty mischief evil', category: 'smileys' },
  { emoji: '👿', name: 'angry face with horns demon mad evil', category: 'smileys' },
  { emoji: '💀', name: 'skull dead dying funny rip skeleton', category: 'vibes' },
  { emoji: '☠️', name: 'skull and crossbones poison danger pirate death', category: 'vibes' },
  { emoji: '💩', name: 'pile of poo poop funny joke stinky', category: 'smileys' },
  { emoji: '🤡', name: 'clown face circus silly foolish fool', category: 'smileys' },
  { emoji: '👻', name: 'ghost spooky halloween boo spirit', category: 'smileys' },
  { emoji: '👽', name: 'alien ufo extra terrestrial sci-fi', category: 'smileys' },
  { emoji: '🤖', name: 'robot bot AI automated artificial intelligence machine', category: 'smileys' },

  // ── Gestures & Hands ──
  { emoji: '👋', name: 'waving hand wave hi hello goodbye bye greetings', category: 'gestures' },
  { emoji: '🤚', name: 'raised back of hand stop high five hold', category: 'gestures' },
  { emoji: '🖐️', name: 'hand with fingers splayed stop five palm', category: 'gestures' },
  { emoji: '✋', name: 'raised hand stop high five halt question volunteer', category: 'gestures' },
  { emoji: '🖖', name: 'vulcan salute spock star trek live long peace', category: 'gestures' },
  { emoji: '👌', name: 'ok hand perfect alright correct fine good', category: 'gestures' },
  { emoji: '🤌', name: 'pinched fingers italian what do you want gesture', category: 'gestures' },
  { emoji: '🤏', name: 'pinching hand tiny small bit little close', category: 'gestures' },
  { emoji: '✌️', name: 'victory hand peace two v sign win', category: 'gestures' },
  { emoji: '🤞', name: 'crossed fingers good luck hope wish fingers crossed', category: 'gestures' },
  { emoji: '🤟', name: 'love-you gesture ily sign rock love', category: 'gestures' },
  { emoji: '🤘', name: 'sign of the horns rock on heavy metal concert party', category: 'gestures' },
  { emoji: '🤙', name: 'call me hand shaka hang loose phone chill', category: 'gestures' },
  { emoji: '👈', name: 'backhand index pointing left direction this that', category: 'gestures' },
  { emoji: '👉', name: 'backhand index pointing right direction there', category: 'gestures' },
  { emoji: '👆', name: 'backhand index pointing up up this above agree', category: 'gestures' },
  { emoji: '👇', name: 'backhand index pointing down below look read', category: 'gestures' },
  { emoji: '☝️', name: 'index pointing up one wait excuse me question', category: 'gestures' },
  { emoji: '✊', name: 'raised fist solidarity power strength resist punch', category: 'gestures' },
  { emoji: '👊', name: 'oncoming fist brofist punch hit respect bump', category: 'gestures' },
  { emoji: '🤛', name: 'left-facing fist bump knuckle bro', category: 'gestures' },
  { emoji: '🤜', name: 'right-facing fist bump knuckle bro', category: 'gestures' },
  { emoji: '🙌', name: 'raising hands celebrate praise hooray two hands', category: 'gestures' },
  { emoji: '👐', name: 'open hands hug welcome open', category: 'gestures' },
  { emoji: '🤲', name: 'palms up together pray offering hold', category: 'gestures' },
  { emoji: '✍️', name: 'writing hand write notes message pen homework', category: 'gestures' },
  { emoji: '💅', name: 'nail polish sassy stylish chic diva', category: 'gestures' },
  { emoji: '🤳', name: 'selfie camera photo take picture phone', category: 'gestures' },
  { emoji: '💪', name: 'flexed biceps muscle strong power workout fitness gym flex', category: 'gestures' },

  // ── Hearts & Affection ──
  { emoji: '💖', name: 'sparkling heart pink shine love glitter romance', category: 'hearts' },
  { emoji: '💗', name: 'growing heart love heartbeat emotion pulsing', category: 'hearts' },
  { emoji: '💓', name: 'beating heart love vibration affection', category: 'hearts' },
  { emoji: '💞', name: 'revolving hearts love twirling romance', category: 'hearts' },
  { emoji: '💕', name: 'two hearts love floating affection friendship', category: 'hearts' },
  { emoji: '💘', name: 'heart with arrow cupid crush romance', category: 'hearts' },
  { emoji: '💝', name: 'heart with ribbon gift present love valentine', category: 'hearts' },
  { emoji: '💟', name: 'heart decoration purple badge', category: 'hearts' },
  { emoji: '🧡', name: 'orange heart friendship warmth autumn', category: 'hearts' },
  { emoji: '💛', name: 'yellow heart friendship joy sunny best friend', category: 'hearts' },
  { emoji: '💚', name: 'green heart nature health jealousy green', category: 'hearts' },
  { emoji: '💙', name: 'blue heart trust peace loyalty cold blue', category: 'hearts' },
  { emoji: '💜', name: 'purple heart purple honor luxury mystery', category: 'hearts' },
  { emoji: '🖤', name: 'black heart dark gothic edgy black', category: 'hearts' },
  { emoji: '🤍', name: 'white heart pure peace angel white', category: 'hearts' },
  { emoji: '🤎', name: 'brown heart warm earth coffee brown', category: 'hearts' },
  { emoji: '💔', name: 'broken heart heartbroken breakup sad hurt pain', category: 'hearts' },
  { emoji: '❣️', name: 'heart exclamation mark love punctuation attention', category: 'hearts' },

  // ── Objects & Tech ──
  { emoji: '💻', name: 'laptop computer code tech developer macbook screen', category: 'objects' },
  { emoji: '🖥️', name: 'desktop computer monitor pc workstation tech', category: 'objects' },
  { emoji: '📱', name: 'mobile phone smartphone iphone android text app', category: 'objects' },
  { emoji: '⌨️', name: 'keyboard type typing key input code', category: 'objects' },
  { emoji: '🎧', name: 'headphones music audio podcast listen sound beats', category: 'objects' },
  { emoji: '🔔', name: 'bell notification chime alert reminder ring', category: 'objects' },
  { emoji: '🔕', name: 'bell with slash mute silent quiet dnd off', category: 'objects' },
  { emoji: '📢', name: 'loudspeaker announcement shout bullhorn megaphone', category: 'objects' },
  { emoji: '📣', name: 'megaphone cheer announcement shout news', category: 'objects' },
  { emoji: '🎮', name: 'video game controller gaming play gamer arcade', category: 'objects' },
  { emoji: '📸', name: 'camera with flash photography photo picture snap', category: 'objects' },
  { emoji: '🎥', name: 'movie camera film cinema video record shoot', category: 'objects' },
  { emoji: '🎙️', name: 'studio microphone audio recording voice podcast mic', category: 'objects' },
  { emoji: '📌', name: 'pushpin pinned notice memo sticky important note', category: 'objects' },
  { emoji: '📍', name: 'round pushpin location map destination pin spot', category: 'objects' },
  { emoji: '📎', name: 'paperclip attachment file document paper', category: 'objects' },
  { emoji: '📝', name: 'memo notepad note document memo checklist write', category: 'objects' },
  { emoji: '📚', name: 'books reading study library education school', category: 'objects' },
  { emoji: '🔒', name: 'locked padlock security safe protect privacy key', category: 'objects' },
  { emoji: '🔓', name: 'unlocked padlock open accessible security access', category: 'objects' },
  { emoji: '🔑', name: 'key secret password unlock access solution', category: 'objects' },
  { emoji: '⚙️', name: 'gear settings options mechanical engineering tool', category: 'objects' },
  { emoji: '🛠️', name: 'hammer and wrench tools fix repair build customize', category: 'objects' },
  { emoji: '🚨', name: 'police car light emergency siren warning alarm urgent', category: 'objects' },
  { emoji: '📦', name: 'package parcel box delivery ship amazon order', category: 'objects' },
  { emoji: '💰', name: 'money bag dollar rich cash wealth profit', category: 'objects' },
  { emoji: '💎', name: 'gem stone diamond crystal luxury precious shiny', category: 'objects' },
  { emoji: '🎈', name: 'balloon party birthday celebrate red inflate', category: 'objects' },
  { emoji: '🎁', name: 'wrapped gift present birthday surprise box wrap', category: 'objects' },

  // ── Food, Drink & Nature ──
  { emoji: '☕', name: 'hot beverage coffee tea espresso cafe break morning', category: 'food' },
  { emoji: '🍵', name: 'teacup without handle green tea matcha healthy', category: 'food' },
  { emoji: '🧋', name: 'boba bubble tea milk pearl drink', category: 'food' },
  { emoji: '🍺', name: 'beer mug drink alcohol cheers pub lager', category: 'food' },
  { emoji: '🍻', name: 'clinking beer mugs cheers party toast drinks bar', category: 'food' },
  { emoji: '🥂', name: 'clinking glasses champagne toast celebration wine cheers', category: 'food' },
  { emoji: '🍷', name: 'wine glass red wine drink alcohol vineyard', category: 'food' },
  { emoji: '🍕', name: 'pizza slice cheese pepperoni fast food delicious slice', category: 'food' },
  { emoji: '🍔', name: 'hamburger burger fast food cheeseburger beef bun', category: 'food' },
  { emoji: '🍟', name: 'french fries chips fast food potato snack', category: 'food' },
  { emoji: '🍿', name: 'popcorn movie cinema snack theater butter', category: 'food' },
  { emoji: '🍩', name: 'doughnut donut sweet pastry glaze sprinkle', category: 'food' },
  { emoji: '🎂', name: 'birthday cake celebration candles party dessert sweet', category: 'food' },
  { emoji: '🍪', name: 'cookie chocolate chip baked biscuit snack sweet', category: 'food' },
  { emoji: '🍎', name: 'red apple fruit healthy fresh teacher snack', category: 'food' },
  { emoji: '🥑', name: 'avocado fruit guacamole healthy salad green', category: 'food' },
  { emoji: '🐶', name: 'dog face puppy pet animal canine cute bark', category: 'food' },
  { emoji: '🐱', name: 'cat face kitten pet animal feline cute meow', category: 'food' },
  { emoji: '🦊', name: 'fox face sly clever animal orange wild', category: 'food' },
  { emoji: '🐼', name: 'panda face bear cute bamboo animal', category: 'food' },
  { emoji: '🦁', name: 'lion face king beast cat animal roar brave', category: 'food' },
  { emoji: '🚗', name: 'automobile car vehicle drive travel red road', category: 'food' },
  { emoji: '✈️', name: 'airplane plane flight travel journey holiday vacation', category: 'food' },
];

const DEFAULT_RECENTS = ['👍', '❤️', '🔥', '😂', '⭐', '🤝', '🎉', '🚀', '💯', '👏', '🙏', '✨'];

export const EmojiPicker = ({ onSelect, onClose }) => {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [recents, setRecents] = useState(() => {
    try {
      const raw = localStorage.getItem('chatrooms_recent_emojis');
      return raw ? JSON.parse(raw) : DEFAULT_RECENTS;
    } catch {
      return DEFAULT_RECENTS;
    }
  });

  const searchInputRef = useRef(null);

  const handleEmojiClick = (emoji) => {
    // 1. Send selected emoji to parent composer
    onSelect(emoji);

    // 2. Persist to recents in localStorage
    try {
      const updated = [emoji, ...recents.filter((e) => e !== emoji)].slice(0, 18);
      setRecents(updated);
      localStorage.setItem('chatrooms_recent_emojis', JSON.stringify(updated));
    } catch {}
  };

  const handleClearSearch = () => {
    setSearch('');
    searchInputRef.current?.focus();
  };

  const handleCategorySelect = (catId) => {
    setActiveCategory(catId);
    if (search) {
      setSearch(''); // Auto-clear search when browsing category
    }
  };

  const filteredEmojis = useMemo(() => {
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      return EMOJI_DATABASE.filter(
        (item) => item.emoji.includes(q) || item.name.toLowerCase().includes(q)
      );
    }

    if (activeCategory === 'recent') {
      return recents.map((emoji) => {
        const found = EMOJI_DATABASE.find((e) => e.emoji === emoji);
        return found || { emoji, name: emoji, category: 'recent' };
      });
    }

    if (activeCategory === 'all') {
      return EMOJI_DATABASE;
    }

    return EMOJI_DATABASE.filter((item) => item.category === activeCategory);
  }, [search, activeCategory, recents]);

  return (
    <div className="w-[min(340px,calc(100vw-20px))] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-2xl shadow-2xl p-3 flex flex-col gap-2.5 z-50 select-none font-heading backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
      {/* Header with Title, Multi-select hint, and Close button */}
      <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-[var(--text-primary)] tracking-wide">
            Emojis
          </span>
          <span className="text-[10px] text-[var(--accent)] font-body font-semibold px-1.5 py-0.2 rounded-full bg-[var(--accent)]/10">
            Tap to insert multiple
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] bg-transparent border-none cursor-pointer transition-colors"
          title="Close emoji picker"
        >
          <X size={14} />
        </button>
      </div>

      {/* Search Bar with Instant Clear Button (✕) */}
      <div className="relative flex items-center">
        <Search size={13} className="absolute left-2.5 text-[var(--text-muted)] pointer-events-none" />
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search emoji (smile, fire, love, car)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-7 pr-8 py-1.5 bg-[var(--bg-primary)] border border-[var(--border)] rounded-xl text-xs font-body text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)] transition-colors"
        />
        {search && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="absolute right-2 p-1 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] cursor-pointer border-none bg-transparent flex items-center justify-center transition-colors"
            title="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Category Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-1 text-xs">
        {CATEGORIES.map((cat) => {
          const isActive = !search && activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategorySelect(cat.id)}
              className={`px-2 py-1 rounded-lg font-bold text-[11px] whitespace-nowrap cursor-pointer transition-all border-none flex items-center gap-1 ${
                isActive
                  ? 'bg-[var(--accent)] text-white shadow-xs'
                  : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Frequently Used Quick Bar (shown when not searching) */}
      {!search && activeCategory === 'all' && recents.length > 0 && (
        <div className="border-b border-[var(--border-subtle)] pb-2">
          <div className="text-[10px] text-[var(--text-muted)] font-semibold mb-1 px-1 flex items-center justify-between">
            <span>Frequently Used</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {recents.slice(0, 8).map((recEmoji, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleEmojiClick(recEmoji)}
                className="w-8 h-8 rounded-lg hover:bg-[var(--accent)] hover:text-white transition-all flex items-center justify-center text-lg cursor-pointer border-none bg-[var(--bg-primary)] hover:scale-110 active:scale-90"
              >
                {recEmoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Emoji Grid */}
      <div className="grid grid-cols-7 gap-1 max-h-56 overflow-y-auto custom-scrollbar p-1">
        {filteredEmojis.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => handleEmojiClick(item.emoji)}
            title={item.name ? item.name.split(' ')[0] : item.emoji}
            className="w-9 h-9 rounded-lg hover:bg-[var(--accent)] hover:text-white transition-all flex items-center justify-center text-xl cursor-pointer border-none bg-transparent hover:scale-115 active:scale-90"
          >
            {item.emoji}
          </button>
        ))}

        {filteredEmojis.length === 0 && (
          <div className="col-span-7 py-8 text-center text-xs text-[var(--text-muted)] font-body flex flex-col items-center gap-1.5">
            <span>No emoji found for "{search}"</span>
            <button
              type="button"
              onClick={handleClearSearch}
              className="px-2.5 py-1 rounded-lg bg-[var(--accent)]/15 text-[var(--accent)] text-xs font-bold border-none cursor-pointer hover:bg-[var(--accent)]/25"
            >
              Clear Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmojiPicker;
