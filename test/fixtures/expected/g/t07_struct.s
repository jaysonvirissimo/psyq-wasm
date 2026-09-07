	.file	1 "t07_struct.c"
gcc2_compiled.:
__gnu_compiled_c:
	.text
	.align	2
	.globl	get_field
	.align	2
	.globl	get_c
	.align	2
	.globl	get_uc
	.align	2
	.globl	get_s
	.align	2
	.globl	get_arr2
	.align	2
	.globl	get_next_value
	.align	2
	.globl	set_all
	.align	2
	.globl	copy_foo
	.align	2
	.globl	make_small
	.align	2
	.globl	sum_small
	.align	2
	.globl	walk

	.text
	.def	Foo;	.scl	10;	.type	0x8;	.size	24;	.endef
	.def	value;	.val	0;	.scl	8;	.type	0x4;	.endef
	.def	s;	.val	4;	.scl	8;	.type	0x3;	.endef
	.def	c;	.val	6;	.scl	8;	.type	0x2;	.endef
	.def	uc;	.val	7;	.scl	8;	.type	0xc;	.endef
	.def	arr;	.val	8;	.scl	8;	.dim	3;	.size	12;	.type	0x34;	.endef
	.def	next;	.val	20;	.scl	8;	.tag	Foo;	.size	24;	.type	0x18;	.endef
	.def	.eos;	.val	24;	.scl	102;	.tag	Foo;	.size	24;	.endef
	.def	Small;	.scl	10;	.type	0x8;	.size	4;	.endef
	.def	a;	.val	0;	.scl	8;	.type	0x3;	.endef
	.def	b;	.val	2;	.scl	8;	.type	0x3;	.endef
	.def	.eos;	.val	4;	.scl	102;	.tag	Small;	.size	4;	.endef
	.def	get_field;	.val	get_field;	.scl	2;	.type	0x24;	.endef
	.text

	.loc	1 3
LM1:

	.loc	1 3
LM2:
	.ent	get_field
get_field:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.def	x;	.val	4;	.scl	17;	.tag	Foo;	.size	24;	.type	0x18;	.endef
	lw	$2,0($4)
	j	$31

	.loc	1 3
LM3:
	.end	get_field
	.def	get_c;	.val	get_c;	.scl	2;	.type	0x24;	.endef
	.text

	.loc	1 4
LM4:

	.loc	1 4
LM5:
	.ent	get_c
get_c:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.def	x;	.val	4;	.scl	17;	.tag	Foo;	.size	24;	.type	0x18;	.endef
	lbu	$2,6($4)
	j	$31

	.loc	1 4
LM6:
	.end	get_c
	.def	get_uc;	.val	get_uc;	.scl	2;	.type	0x24;	.endef
	.text

	.loc	1 5
LM7:

	.loc	1 5
LM8:
	.ent	get_uc
get_uc:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.def	x;	.val	4;	.scl	17;	.tag	Foo;	.size	24;	.type	0x18;	.endef
	lbu	$2,7($4)
	j	$31

	.loc	1 5
LM9:
	.end	get_uc
	.def	get_s;	.val	get_s;	.scl	2;	.type	0x24;	.endef
	.text

	.loc	1 6
LM10:

	.loc	1 6
LM11:
	.ent	get_s
get_s:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.def	x;	.val	4;	.scl	17;	.tag	Foo;	.size	24;	.type	0x18;	.endef
	lh	$2,4($4)
	j	$31

	.loc	1 6
LM12:
	.end	get_s
	.def	get_arr2;	.val	get_arr2;	.scl	2;	.type	0x24;	.endef
	.text

	.loc	1 7
LM13:

	.loc	1 7
LM14:
	.ent	get_arr2
get_arr2:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.def	x;	.val	4;	.scl	17;	.tag	Foo;	.size	24;	.type	0x18;	.endef
	lw	$2,16($4)
	j	$31

	.loc	1 7
LM15:
	.end	get_arr2
	.def	get_next_value;	.val	get_next_value;	.scl	2;	.type	0x24;	.endef
	.text

	.loc	1 8
LM16:

	.loc	1 8
LM17:
	.ent	get_next_value
get_next_value:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.def	x;	.val	4;	.scl	17;	.tag	Foo;	.size	24;	.type	0x18;	.endef
	lw	$2,20($4)
	#nop
	lw	$2,20($2)
	#nop
	lw	$2,0($2)
	j	$31

	.loc	1 8
LM18:
	.end	get_next_value
	.def	set_all;	.val	set_all;	.scl	2;	.type	0x21;	.endef
	.text

	.loc	1 9
LM19:

	.loc	1 9
LM20:
	.ent	set_all
set_all:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.def	x;	.val	4;	.scl	17;	.tag	Foo;	.size	24;	.type	0x18;	.endef
	.def	v;	.val	5;	.scl	17;	.type	0x4;	.endef
	sw	$5,0($4)
	sh	$5,4($4)
	sb	$5,6($4)
	.set	noreorder
	.set	nomacro
	j	$31
	sw	$5,8($4)
	.set	macro
	.set	reorder


	.loc	1 9
LM21:
	.end	set_all
	.def	copy_foo;	.val	copy_foo;	.scl	2;	.type	0x21;	.endef
	.text

	.loc	1 10
LM22:

	.loc	1 10
LM23:
	.ent	copy_foo
copy_foo:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.def	d;	.val	4;	.scl	17;	.tag	Foo;	.size	24;	.type	0x18;	.endef
	.def	s;	.val	5;	.scl	17;	.tag	Foo;	.size	24;	.type	0x18;	.endef
	lw	$2,0($5)
	lw	$3,4($5)
	lw	$6,8($5)
	lw	$7,12($5)
	sw	$2,0($4)
	sw	$3,4($4)
	sw	$6,8($4)
	sw	$7,12($4)
	lw	$2,16($5)
	lw	$3,20($5)
	sw	$2,16($4)
	.set	noreorder
	.set	nomacro
	j	$31
	sw	$3,20($4)
	.set	macro
	.set	reorder


	.loc	1 10
LM24:
	.end	copy_foo
	.def	make_small;	.val	make_small;	.scl	2;	.tag	Small;	.size	4;	.type	0x28;	.endef
	.text

	.loc	1 11
LM25:

	.loc	1 11
LM26:
	.ent	make_small
make_small:
	.frame	$sp,8,$31		# vars= 8, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.def	a;	.val	5;	.scl	17;	.type	0x3;	.endef
	.def	b;	.val	6;	.scl	17;	.type	0x3;	.endef
$Lb0:
	.begin	$Lb0	1
	.def	r;	.val	-8;	.scl	1;	.tag	Small;	.size	4;	.type	0x8;	.endef
$Le1:
	.bend	$Le1	1
	subu	$sp,$sp,8
	move	$2,$4
	sh	$5,0($sp)
	sh	$6,2($sp)
	lwl	$3,3($sp)
	lwr	$3,0($sp)
	swl	$3,3($2)
	swr	$3,0($2)
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$sp,$sp,8
	.set	macro
	.set	reorder


	.loc	1 11
LM27:
	.end	make_small
	.def	sum_small;	.val	sum_small;	.scl	2;	.type	0x24;	.endef
	.text

	.loc	1 12
LM28:

	.loc	1 12
LM29:
	.ent	sum_small
sum_small:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.def	s;	.val	0;	.scl	9;	.tag	Small;	.size	4;	.type	0x8;	.endef
	sw	$4,0($sp)
	lh	$3,0($sp)
	lh	$2,2($sp)
	.set	noreorder
	.set	nomacro
	j	$31
	addu	$2,$3,$2
	.set	macro
	.set	reorder


	.loc	1 12
LM30:
	.end	sum_small
	.def	walk;	.val	walk;	.scl	2;	.type	0x24;	.endef
	.text

	.loc	1 13
LM31:

	.loc	1 13
LM32:
	.ent	walk
walk:
	.frame	$sp,0,$31		# vars= 0, regs= 0/0, args= 0, extra= 0
	.mask	0x00000000,0
	.fmask	0x00000000,0
	.def	x;	.val	4;	.scl	17;	.tag	Foo;	.size	24;	.type	0x18;	.endef
$Lb2:
	.begin	$Lb2	1
	.def	n;	.val	3;	.scl	4;	.type	0x4;	.endef
	.set	noreorder
	.set	nomacro
	beq	$4,$0,$L13
	move	$3,$0
	.set	macro
	.set	reorder

$L14:
	lw	$2,0($4)
	lw	$4,20($4)
	#nop
	.set	noreorder
	.set	nomacro
	bne	$4,$0,$L14
	addu	$3,$3,$2
	.set	macro
	.set	reorder

$L13:
$Le3:
	.bend	$Le3	1
	.set	noreorder
	.set	nomacro
	j	$31
	move	$2,$3
	.set	macro
	.set	reorder


	.loc	1 13
LM33:
	.end	walk
